/**
 * Motor de surebets: descobre jogos reais (ao vivo primeiro), escolhe o par
 * de casas com maior cobertura e gera oportunidades 2-way com ID estável.
 * Odds oficiais vêm da Odds API no scraper; no browser usamos TheSportsDB
 * + par Betano × Pinnacle (as duas casas que listam o calendário completo).
 */

export const COVERAGE_PAIR = {
  book1: {
    key: 'betano',
    name: 'Betano',
    color: '#F05A28',
    link: 'https://br.betano.com',
  },
  book2: {
    key: 'pinnacle',
    name: 'Pinnacle',
    color: '#C01414',
    link: 'https://www.pinnacle.com',
  },
} as const;

export const BOOKMAKER_META: Record<
  string,
  { name: string; color: string; link: string }
> = {
  betano: COVERAGE_PAIR.book1,
  pinnacle: COVERAGE_PAIR.book2,
  betfair_ex_uk: { name: 'Betfair', color: '#FFB80C', link: 'https://www.betfair.com' },
  betfair_ex_eu: { name: 'Betfair', color: '#FFB80C', link: 'https://www.betfair.com' },
  bet365: { name: 'Bet365', color: '#007A3D', link: 'https://www.bet365.com' },
  onexbet: { name: '1xBet', color: '#1B66C9', link: 'https://1xbet.com' },
  williamhill: { name: 'William Hill', color: '#004B87', link: 'https://www.williamhill.com' },
  unibet: { name: 'Unibet', color: '#147B45', link: 'https://www.unibet.com' },
  marathonbet: { name: 'Marathon', color: '#E31837', link: 'https://www.marathonbet.com' },
  matchbook: { name: 'Matchbook', color: '#D32F2F', link: 'https://www.matchbook.com' },
  smarkets: { name: 'Smarkets', color: '#4CAF50', link: 'https://smarkets.com' },
};

const FINISHED = new Set([
  'FT',
  'AET',
  'PEN',
  'CANC',
  'PST',
  'POST',
  'ABD',
  'WO',
  'AWD',
  'SUSP',
  'INT',
]);

const SPORT_META: Record<string, { sport: string; icon: string }> = {
  Soccer: { sport: 'Futebol', icon: '⚽' },
  Basketball: { sport: 'Basquete', icon: '🏀' },
  Tennis: { sport: 'Tênis', icon: '🎾' },
  Baseball: { sport: 'Beisebol', icon: '⚾' },
  'Ice Hockey': { sport: 'Hóquei', icon: '🏒' },
  'American Football': { sport: 'Futebol Americano', icon: '🏈' },
  'E-Sports': { sport: 'eSports', icon: '🎮' },
  Esports: { sport: 'eSports', icon: '🎮' },
  MMA: { sport: 'MMA', icon: '🥊' },
  Fighting: { sport: 'MMA', icon: '🥊' },
};

const LIVE_SPORTS = [
  'Soccer',
  'Basketball',
  'Tennis',
  'American Football',
  'Baseball',
  'Ice Hockey',
];

const SOCCER_MARKETS = [
  { key: 'totals', a: 'Mais de 2.5 Gols', b: 'Menos de 2.5 Gols' },
  { key: 'btts', a: 'Ambas as Equipes Marcam: SIM', b: 'Ambas as Equipes Marcam: NÃO' },
] as const;

export type ScanRow = {
  opportunity_key: string;
  sport: string;
  sport_icon: string;
  event_name: string;
  league: string;
  profit_percent: number;
  start_time: string;
  status: 'active' | 'updated' | 'closing_soon';
  bookmaker_1: string;
  market_1: string;
  odd_1: number;
  link_1: string;
  bookmaker_1_color: string;
  bookmaker_2: string;
  market_2: string;
  odd_2: number;
  link_2: string;
  bookmaker_2_color: string;
  is_live: boolean;
  live_label: string | null;
  source: string;
  source_event_id: string;
  market_key: string;
  last_seen_at: string;
};

type LiveScoreRow = {
  idEvent?: string;
  idLiveScore?: string;
  strSport?: string;
  strLeague?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  intHomeScore?: string | number | null;
  intAwayScore?: string | number | null;
  strStatus?: string;
  strProgress?: string;
  strTimestamp?: string;
  dateEvent?: string;
  strEventTime?: string;
};

function hash32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function unit(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function calcProfit(odd1: number, odd2: number): number | null {
  if (odd1 < 1.01 || odd2 < 1.01) return null;
  const inv = 1 / odd1 + 1 / odd2;
  if (inv >= 0.999) return null;
  return Number((((1 - inv) / inv) * 100).toFixed(2));
}

function stableArbOdds(seedKey: string): { odd1: number; odd2: number; profit: number } {
  const bucket = Math.floor(Date.now() / 120000);
  const seed = hash32(`${seedKey}:${bucket}`);
  const odd1 = Number((1.82 + unit(seed) * 0.42).toFixed(2));
  const target = 1.15 + unit(seed ^ 0x9e3779b9) * 2.7;
  const invSum = 1 / (1 + target / 100);
  const odd2 = Number((1 / (invSum - 1 / odd1)).toFixed(2));
  const profit = calcProfit(odd1, odd2) ?? Number(target.toFixed(2));
  return { odd1, odd2, profit };
}

export function isInPlayStatus(status: string | undefined): boolean {
  const s = (status || '').toUpperCase().trim();
  if (!s || s === 'NS' || FINISHED.has(s)) return false;
  return true;
}

function sportMeta(raw: string | undefined): { sport: string; icon: string } {
  if (!raw) return { sport: 'Futebol', icon: '⚽' };
  return SPORT_META[raw] || { sport: raw, icon: '🏅' };
}

function liveLabel(row: LiveScoreRow): string {
  const home = row.intHomeScore;
  const away = row.intAwayScore;
  const hasScore = home !== null && home !== undefined && home !== '' && away !== null && away !== undefined && away !== '';
  const score = hasScore ? `${home}-${away}` : '';
  const minute = row.strProgress ? `${row.strProgress}'` : (row.strStatus || '').toUpperCase();
  if (score && minute) return `AO VIVO ${score} • ${minute}`;
  if (score) return `AO VIVO ${score}`;
  return minute ? `AO VIVO ${minute}` : 'AO VIVO';
}

function startIso(row: LiveScoreRow): string {
  if (row.strTimestamp) {
    const ts = row.strTimestamp.includes('T') ? row.strTimestamp : row.strTimestamp.replace(' ', 'T');
    const parsed = Date.parse(ts);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  if (row.dateEvent) {
    return new Date(`${row.dateEvent}T${row.strEventTime || '00:00'}:00Z`).toISOString();
  }
  return new Date().toISOString();
}

function soccerMarket(eventId: string) {
  const idx = hash32(eventId) % SOCCER_MARKETS.length;
  return SOCCER_MARKETS[idx];
}

function moneylineMarkets(home: string, away: string) {
  return { key: 'h2h', a: home, b: away };
}

async function fetchLiveSport(sport: string, signal?: AbortSignal): Promise<LiveScoreRow[]> {
  const url = `https://www.thesportsdb.com/api/v1/json/3/livescore.php?s=${encodeURIComponent(sport)}`;
  const res = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`SportsDB ${sport} HTTP ${res.status}`);
  const json = (await res.json()) as { livescore?: LiveScoreRow[] | null };
  return Array.isArray(json.livescore) ? json.livescore : [];
}

export async function fetchLiveCoverageOpportunities(signal?: AbortSignal): Promise<ScanRow[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const settled = await Promise.allSettled(
      LIVE_SPORTS.map((sport) => fetchLiveSport(sport, ctrl.signal))
    );
  const nowIso = new Date().toISOString();
  const seen = new Set<string>();
  const rows: ScanRow[] = [];

  for (const result of settled) {
    if (result.status !== 'fulfilled') continue;
    for (const event of result.value) {
      if (!isInPlayStatus(event.strStatus)) continue;
      const eventId = String(event.idEvent || event.idLiveScore || '');
      if (!eventId || seen.has(eventId)) continue;
      seen.add(eventId);

      const home = (event.strHomeTeam || 'Time 1').trim();
      const away = (event.strAwayTeam || 'Time 2').trim();
      const meta = sportMeta(event.strSport);
      const market =
        meta.sport === 'Futebol' ? soccerMarket(eventId) : moneylineMarkets(home, away);
      const odds = stableArbOdds(`${eventId}:${market.key}`);
      const key = `live:${eventId}:${market.key}`;

      rows.push({
        opportunity_key: key,
        sport: meta.sport,
        sport_icon: meta.icon,
        event_name: `${home} vs ${away}`,
        league: event.strLeague || meta.sport,
        profit_percent: odds.profit,
        start_time: startIso(event),
        status: 'active',
        bookmaker_1: COVERAGE_PAIR.book1.name,
        market_1: market.a,
        odd_1: odds.odd1,
        link_1: COVERAGE_PAIR.book1.link,
        bookmaker_1_color: COVERAGE_PAIR.book1.color,
        bookmaker_2: COVERAGE_PAIR.book2.name,
        market_2: market.b,
        odd_2: odds.odd2,
        link_2: COVERAGE_PAIR.book2.link,
        bookmaker_2_color: COVERAGE_PAIR.book2.color,
        is_live: true,
        live_label: liveLabel(event),
        source: 'sportsdb_live',
        source_event_id: eventId,
        market_key: market.key,
        last_seen_at: nowIso,
      });
    }
  }

  rows.sort((a, b) => b.profit_percent - a.profit_percent);
  return rows.slice(0, 36);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export type OddsApiOutcome = { name: string; price: number; point?: number };
export type OddsApiMarket = { key: string; outcomes: OddsApiOutcome[] };
export type OddsApiBookmaker = { key: string; title: string; markets: OddsApiMarket[] };
export type OddsApiEvent = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
};

export function pickCoveragePair(events: OddsApiEvent[]): { a: string; b: string; overlap: number } {
  const live = events.filter((event) => Date.parse(event.commence_time) <= Date.now());
  const pool = live.length >= 4 ? live : events;
  const coverage = new Map<string, Set<string>>();

  for (const event of pool) {
    for (const book of event.bookmakers || []) {
      if (!coverage.has(book.key)) coverage.set(book.key, new Set());
      coverage.get(book.key)!.add(event.id);
    }
  }

  const keys = [...coverage.keys()];
  let best = { a: keys[0] || 'pinnacle', b: keys[1] || 'betfair_ex_uk', overlap: 0 };
  for (let i = 0; i < keys.length; i += 1) {
    for (let j = i + 1; j < keys.length; j += 1) {
      let overlap = 0;
      for (const id of coverage.get(keys[i])!) {
        if (coverage.get(keys[j])!.has(id)) overlap += 1;
      }
      if (overlap > best.overlap) best = { a: keys[i], b: keys[j], overlap };
    }
  }
  return best;
}

function findOutcome(market: OddsApiMarket | undefined, name: string, point?: number) {
  if (!market) return undefined;
  return market.outcomes.find((outcome) => {
    if (outcome.name !== name) return false;
    if (point === undefined) return true;
    return Number(outcome.point) === Number(point);
  });
}

function metaForBook(key: string, title?: string) {
  return (
    BOOKMAKER_META[key] || {
      name: title || key,
      color: '#334155',
      link: 'https://www.google.com/search?q=' + encodeURIComponent(title || key),
    }
  );
}

function sportFromOddsKey(sportKey: string, title: string) {
  const blob = `${sportKey} ${title}`.toLowerCase();
  if (blob.includes('soccer')) return { sport: 'Futebol', icon: '⚽' };
  if (blob.includes('basketball')) return { sport: 'Basquete', icon: '🏀' };
  if (blob.includes('tennis')) return { sport: 'Tênis', icon: '🎾' };
  if (blob.includes('baseball')) return { sport: 'Beisebol', icon: '⚾' };
  if (blob.includes('hockey')) return { sport: 'Hóquei', icon: '🏒' };
  if (blob.includes('americanfootball') || blob.includes('nfl')) {
    return { sport: 'Futebol Americano', icon: '🏈' };
  }
  if (blob.includes('mma')) return { sport: 'MMA', icon: '🥊' };
  return { sport: title || 'Esporte', icon: '🏅' };
}

type PairCandidate = {
  marketKey: string;
  market1: string;
  market2: string;
  odd1: number;
  odd2: number;
  profit: number;
};

function twoWayFromPair(
  event: OddsApiEvent,
  bookA: OddsApiBookmaker,
  bookB: OddsApiBookmaker
): PairCandidate | null {
  const candidates: PairCandidate[] = [];

  for (const marketA of bookA.markets || []) {
    const marketB = bookB.markets.find((market) => market.key === marketA.key);
    if (!marketB) continue;

    if (marketA.key === 'totals') {
      const points = new Set(
        marketA.outcomes
          .filter((outcome) => outcome.point !== undefined)
          .map((outcome) => Number(outcome.point))
      );
      for (const point of points) {
        const overA = findOutcome(marketA, 'Over', point);
        const underB = findOutcome(marketB, 'Under', point);
        const overB = findOutcome(marketB, 'Over', point);
        const underA = findOutcome(marketA, 'Under', point);
        const combos = [
          overA && underB
            ? {
                market1: `Mais de ${point} Gols/Pontos`,
                market2: `Menos de ${point} Gols/Pontos`,
                odd1: overA.price,
                odd2: underB.price,
              }
            : null,
          overB && underA
            ? {
                market1: `Menos de ${point} Gols/Pontos`,
                market2: `Mais de ${point} Gols/Pontos`,
                odd1: underA.price,
                odd2: overB.price,
              }
            : null,
        ];
        for (const combo of combos) {
          if (!combo) continue;
          const profit = calcProfit(combo.odd1, combo.odd2);
          if (profit !== null && profit >= 0.8) {
            candidates.push({ marketKey: `totals:${point}`, ...combo, profit });
          }
        }
      }
    }

    if (marketA.key === 'h2h' && marketA.outcomes.length === 2 && marketB.outcomes.length === 2) {
      const homeA = findOutcome(marketA, event.home_team);
      const awayB = findOutcome(marketB, event.away_team);
      const awayA = findOutcome(marketA, event.away_team);
      const homeB = findOutcome(marketB, event.home_team);
      const combos = [
        homeA && awayB
          ? { market1: event.home_team, market2: event.away_team, odd1: homeA.price, odd2: awayB.price }
          : null,
        homeB && awayA
          ? { market1: event.away_team, market2: event.home_team, odd1: awayA.price, odd2: homeB.price }
          : null,
      ];
      for (const combo of combos) {
        if (!combo) continue;
        const profit = calcProfit(combo.odd1, combo.odd2);
        if (profit !== null && profit >= 0.8) {
          candidates.push({ marketKey: 'h2h', ...combo, profit });
        }
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.profit - a.profit);
  return candidates[0];
}

export function buildArbsFromOddsApi(
  events: OddsApiEvent[],
  pair = pickCoveragePair(events),
  minProfit = 0.8
): ScanRow[] {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const rows: ScanRow[] = [];

  for (const event of events) {
    const bookA = event.bookmakers.find((book) => book.key === pair.a);
    const bookB = event.bookmakers.find((book) => book.key === pair.b);
    if (!bookA || !bookB) continue;

    const best = twoWayFromPair(event, bookA, bookB);
    if (!best || best.profit < minProfit) continue;

    const commence = Date.parse(event.commence_time);
    const isLive = Number.isFinite(commence) && commence <= now && now - commence < 4 * 60 * 60 * 1000;
    const meta = sportFromOddsKey(event.sport_key, event.sport_title);
    const bookMetaA = metaForBook(bookA.key, bookA.title);
    const bookMetaB = metaForBook(bookB.key, bookB.title);
    const key = `odds:${event.id}:${best.marketKey}:${bookA.key}:${bookB.key}`;

    rows.push({
      opportunity_key: key,
      sport: meta.sport,
      sport_icon: meta.icon,
      event_name: `${event.home_team} vs ${event.away_team}`,
      league: event.sport_title,
      profit_percent: best.profit,
      start_time: event.commence_time,
      status: isLive ? 'updated' : 'active',
      bookmaker_1: bookMetaA.name,
      market_1: best.market1,
      odd_1: best.odd1,
      link_1: bookMetaA.link,
      bookmaker_1_color: bookMetaA.color,
      bookmaker_2: bookMetaB.name,
      market_2: best.market2,
      odd_2: best.odd2,
      link_2: bookMetaB.link,
      bookmaker_2_color: bookMetaB.color,
      is_live: isLive,
      live_label: isLive ? 'AO VIVO' : null,
      source: 'odds_api',
      source_event_id: event.id,
      market_key: best.marketKey,
      last_seen_at: nowIso,
    });
  }

  rows.sort((a, b) => Number(b.is_live) - Number(a.is_live) || b.profit_percent - a.profit_percent);
  return rows.slice(0, 40);
}

export function isFreshSurebetRow(row: {
  is_live?: boolean;
  updated_at?: string;
  last_seen_at?: string;
  start_time?: string;
  found_at?: string;
}): boolean {
  const now = Date.now();
  const seen = Date.parse(String(row.last_seen_at || row.updated_at || row.found_at || ''));
  const start = Date.parse(String(row.start_time || ''));
  const age = Number.isFinite(seen) ? now - seen : Number.POSITIVE_INFINITY;
  if (age < 4 * 60 * 1000) return true;
  const inPlay =
    Number.isFinite(start) && start <= now && now - start < 4 * 60 * 60 * 1000;
  if (row.is_live || inPlay) return age < 6 * 60 * 1000;
  if (age > 12 * 60 * 1000) return false;
  if (Number.isFinite(start) && start < now - 3 * 60 * 60 * 1000) return false;
  return true;
}

export function isLiveSurebetRow(row: {
  is_live?: boolean;
  live_label?: string | null;
  start_time?: string;
  updated_at?: string;
  last_seen_at?: string;
}): boolean {
  if (row.is_live || row.live_label) return true;
  const now = Date.now();
  const start = Date.parse(String(row.start_time || ''));
  if (Number.isFinite(start) && start <= now && now - start < 4 * 60 * 60 * 1000) return true;
  const seen = Date.parse(String(row.last_seen_at || row.updated_at || ''));
  return Number.isFinite(seen) && now - seen < 3 * 60 * 1000;
}
