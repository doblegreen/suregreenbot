import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient, RealtimeChannel, Session } from '@supabase/supabase-js';
import {
  COVERAGE_PAIR,
  fetchLiveCoverageOpportunities,
  isFreshSurebetRow,
  isLiveSurebetRow,
  type ScanRow,
} from './lib/surebetEngine';
import {
  TrendingUp,
  Calculator,
  CreditCard,
  Users,
  PlayCircle,
  MessageCircle,
  X,
  Send,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Zap,
  ArrowRight,
  Bell,
  RefreshCw,
  Sliders,
  DollarSign,
  Award,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  HelpCircle,
  Lock,
  Sparkles,
  Search,
  Radio,
  Clock,
  Tv,
  Wallet,
  Building2,
  Share2,
  FileText,
  LogIn,
  LogOut,
  User,
} from 'lucide-react';

// --- TYPES ---
export interface SurebetOpportunity {
  id: string;
  sport: string;
  sportIcon: string;
  event: string;
  league: string;
  startTime: string;
  profitPercentage: number;
  bookmaker1: {
    name: string;
    logoColor: string;
    market: string;
    odd: number;
    link: string;
  };
  bookmaker2: {
    name: string;
    logoColor: string;
    market: string;
    odd: number;
    link: string;
  };
  status: 'active' | 'updated' | 'closing_soon';
  foundAt: string;
  isLive: boolean;
  liveLabel?: string;
}

export interface NetworkMember {
  id: string;
  name: string;
  joinedDate: string;
  status: 'active' | 'inactive';
  monthlyCommission: number;
  avatar: string;
}

export interface NetworkLevel {
  level: number;
  percentage: number;
  commissionPerActive: number;
  activeCount: number;
  totalMembers: number;
  monthlyRevenue: number;
  members: NetworkMember[];
}

export interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending';
  invoicePdfUrl: string;
}

export interface TutorialVideo {
  id: string;
  title: string;
  duration: string;
  category: string;
  views: string;
  thumbnailColor: string;
  summary: string;
  videoUrl: string;
  keyPoints: string[];
}

const EMPTY_CALCULATOR: SurebetOpportunity = {
  id: 'empty',
  sport: 'Futebol',
  sportIcon: '⚽',
  event: 'Selecione uma oportunidade',
  league: 'Aguardando scanner',
  startTime: '—',
  profitPercentage: 0,
  bookmaker1: {
    name: COVERAGE_PAIR.book1.name,
    logoColor: COVERAGE_PAIR.book1.color,
    market: 'Casa 1',
    odd: 2.0,
    link: COVERAGE_PAIR.book1.link,
  },
  bookmaker2: {
    name: COVERAGE_PAIR.book2.name,
    logoColor: COVERAGE_PAIR.book2.color,
    market: 'Casa 2',
    odd: 2.0,
    link: COVERAGE_PAIR.book2.link,
  },
  status: 'active',
  foundAt: '—',
  isLive: false,
};

const EMPTY_NETWORK_LEVELS: NetworkLevel[] = [
  { level: 1, percentage: 10, commissionPerActive: 10, activeCount: 0, totalMembers: 0, monthlyRevenue: 0, members: [] },
  { level: 2, percentage: 3, commissionPerActive: 3, activeCount: 0, totalMembers: 0, monthlyRevenue: 0, members: [] },
  { level: 3, percentage: 2, commissionPerActive: 2, activeCount: 0, totalMembers: 0, monthlyRevenue: 0, members: [] },
];

function captureReferralFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref)) {
    localStorage.setItem('surebot_ref', ref);
    return ref;
  }
  return localStorage.getItem('surebot_ref');
}

const TUTORIAL_VIDEOS: TutorialVideo[] = [
  {
    id: 'tut-1',
    title: 'Dominando a Calculadora Inteligente de Auto-Ajuste',
    duration: '08:45',
    category: 'Calculadora & Matemática',
    views: '14.2k visualizações',
    thumbnailColor: 'from-amber-400 to-yellow-500',
    summary: 'Aprenda a fórmula de arbitragem inversa para garantir lucro fixo sem depender de resultado. Demonstração prática com valores reais.',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    keyPoints: [
      'Como funciona a margem de arbitragem L = (1/O1) + (1/O2) < 1',
      'Uso da função Arredondar Aposta para despistar os algoritmos das casas',
      'Execução rápida antes que a odd caia na casa secundária',
    ],
  },
  {
    id: 'tut-2',
    title: 'Gestão Profissional de Banca: A Regra dos 5%',
    duration: '12:20',
    category: 'Gerenciamento de Risco',
    views: '9.8k visualizações',
    thumbnailColor: 'from-purple-600 to-indigo-700',
    summary: 'Como dividir sua banca entre múltiplas casas para manter liquidez contínua e aumentar o volume diário de operações seguras.',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    keyPoints: [
      'Distribuição estratégica entre carteiras digitais e casas europeias e asiáticas',
      'Fluxo de caixa diário e reinvestimento de lucros compostos',
      'Teto máximo por entrada para blindar o patrimônio',
    ],
  },
  {
    id: 'tut-3',
    title: 'Anti-Limitação: Blindando suas Contas em Casas Recreativas',
    duration: '15:10',
    category: 'Segurança Operacional',
    views: '22.5k visualizações',
    thumbnailColor: 'from-emerald-500 to-teal-700',
    summary: 'Técnicas avançadas para simular apostadores recreativos comuns, timing de saques e limpeza de cookies e fingerprints de navegador.',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    keyPoints: [
      'Nunca aposte valores com centavos quebrados (Ex: aposte R$ 150 em vez de R$ 152,43)',
      'Aposte em grandes ligas (Premier League, Champions) onde o volume é imenso',
      'Não solicite saques imediatamente após greens grandes',
    ],
  },
  {
    id: 'tut-4',
    title: 'Escalando sua Renda com a Rede de Afiliados de 3 Níveis',
    duration: '10:30',
    category: 'Afiliados & Recorrência',
    views: '6.4k visualizações',
    thumbnailColor: 'from-blue-600 to-cyan-700',
    summary: 'Como compartilhar seu link de indicação gerando renda passiva perpétua de até 15% na soma dos 3 níveis de comissão.',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    keyPoints: [
      'Nível 1 (10% = R$ 10,00), Nível 2 (3% = R$ 3,00), Nível 3 (2% = R$ 2,00)',
      'Regras para saque automático via PIX a partir de R$ 50,00',
      'Scripts de conversão prontos para WhatsApp e grupos de apostas',
    ],
  },
];

// --- SUPABASE CLIENT INITIALIZATION ---
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://xqdxmqmvyofgletocqzb.supabase.co';
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxZHhtcW12eW9mZ2xldG9jcXpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MzM5NjIsImV4cCI6MjEwNTQwOTk2Mn0.7THA0vQ_JRdTnbVOQ_kM6fpd6PUCd3WpwK2-OGmNex0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function formatStartTime(value: unknown, isLive = false, liveLabel?: string | null): string {
  if (isLive) return liveLabel || 'AO VIVO';
  if (!value) return 'Hoje';
  if (typeof value === 'string' && !value.includes('T') && Number.isNaN(Date.parse(value))) {
    return value;
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFoundAt(value: unknown): string {
  if (!value) return 'Agora mesmo';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return `Há ${diffSec}s`;
  if (diffSec < 3600) return `Há ${Math.floor(diffSec / 60)}m`;
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function mapScanRow(row: ScanRow): SurebetOpportunity {
  return {
    id: row.opportunity_key,
    sport: row.sport,
    sportIcon: row.sport_icon,
    event: row.event_name,
    league: row.league,
    startTime: formatStartTime(row.start_time, row.is_live, row.live_label),
    profitPercentage: row.profit_percent,
    bookmaker1: {
      name: row.bookmaker_1,
      logoColor: row.bookmaker_1_color,
      market: row.market_1,
      odd: row.odd_1,
      link: row.link_1,
    },
    bookmaker2: {
      name: row.bookmaker_2,
      logoColor: row.bookmaker_2_color,
      market: row.market_2,
      odd: row.odd_2,
      link: row.link_2,
    },
    status: row.status,
    foundAt: formatFoundAt(row.last_seen_at),
    isLive: row.is_live,
    liveLabel: row.live_label || undefined,
  };
}

function mapSupabaseRecord(row: any): SurebetOpportunity {
  const isLive = isLiveSurebetRow(row);
  return {
    id: String(row.opportunity_key || row.id || `sb-${Date.now()}`),
    sport: row.sport || 'Futebol',
    sportIcon: row.sport_icon || row.sportIcon || '⚽',
    event:
      row.event_name ||
      row.event ||
      `${row.home_team || 'Time 1'} vs ${row.away_team || 'Time 2'}`,
    league: row.league || 'Campeonato',
    startTime: formatStartTime(row.start_time || row.startTime, isLive, row.live_label),
    profitPercentage: Number(
      row.profit_percent ?? row.profit_percentage ?? row.profitPercentage ?? 0
    ),
    bookmaker1: {
      name: row.bookmaker_1 || row.bookmaker_1_name || row.bookmaker1?.name || COVERAGE_PAIR.book1.name,
      logoColor: row.bookmaker_1_color || row.bookmaker1?.logoColor || COVERAGE_PAIR.book1.color,
      market: row.market_1 || row.bookmaker_1_market || row.bookmaker1?.market || 'Mais de 2.5 Gols',
      odd: Number(row.odd_1 ?? row.bookmaker_1_odd ?? row.bookmaker1?.odd ?? 2.1),
      link: row.link_1 || row.bookmaker_1_link || row.bookmaker1?.link || COVERAGE_PAIR.book1.link,
    },
    bookmaker2: {
      name: row.bookmaker_2 || row.bookmaker_2_name || row.bookmaker2?.name || COVERAGE_PAIR.book2.name,
      logoColor: row.bookmaker_2_color || row.bookmaker2?.logoColor || COVERAGE_PAIR.book2.color,
      market: row.market_2 || row.bookmaker_2_market || row.bookmaker2?.market || 'Menos de 2.5 Gols',
      odd: Number(row.odd_2 ?? row.bookmaker_2_odd ?? row.bookmaker2?.odd ?? 2.12),
      link: row.link_2 || row.bookmaker_2_link || row.bookmaker2?.link || COVERAGE_PAIR.book2.link,
    },
    status: row.status || 'active',
    foundAt: formatFoundAt(row.last_seen_at || row.found_at || row.foundAt),
    isLive,
    liveLabel: row.live_label || undefined,
  };
}

function sortOpportunities(items: SurebetOpportunity[]): SurebetOpportunity[] {
  return [...items].sort((a, b) => {
    if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
    if (a.status === 'closing_soon' && b.status !== 'closing_soon') return 1;
    if (b.status === 'closing_soon' && a.status !== 'closing_soon') return -1;
    return b.profitPercentage - a.profitPercentage;
  });
}

function pickSelection(
  current: SurebetOpportunity,
  list: SurebetOpportunity[]
): SurebetOpportunity {
  if (current.id !== 'empty') {
    return list.find((item) => item.id === current.id) || current;
  }
  return list[0] || EMPTY_CALCULATOR;
}

function mergeOpportunityList(
  prev: SurebetOpportunity[],
  incoming: SurebetOpportunity[],
  selectedId?: string
): SurebetOpportunity[] {
  const next = new Map(prev.map((item) => [item.id, item]));
  for (const item of incoming) next.set(item.id, item);
  if (selectedId && selectedId !== 'empty') {
    const selected = prev.find((item) => item.id === selectedId);
    if (selected && !next.has(selectedId)) next.set(selectedId, selected);
  }
  return sortOpportunities([...next.values()]);
}

export default function App() {
  // Navigation tabs: 'operacoes' | 'assinatura' | 'afiliados' | 'tutoriais'
  const [activeTab, setActiveTab] = useState<'operacoes' | 'assinatura' | 'afiliados' | 'tutoriais'>('operacoes');

  // Surebets state
  const [opportunities, setOpportunities] = useState<SurebetOpportunity[]>([]);
  const [selectedOpportunity, setSelectedOpportunity] = useState<SurebetOpportunity>(EMPTY_CALCULATOR);
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'connecting' | 'simulated'>('connecting');
  const [lastEventTime, setLastEventTime] = useState<string>('Agora');
  const [feedLoading, setFeedLoading] = useState<boolean>(true);
  const [feedFilter, setFeedFilter] = useState<'all' | 'live'>('live');
  const [coveragePairLabel, setCoveragePairLabel] = useState<string>(
    `${COVERAGE_PAIR.book1.name} × ${COVERAGE_PAIR.book2.name}`
  );

  // Calculator State
  const [stake1Input, setStake1Input] = useState<string>('500');
  const [totalStakeInput, setTotalStakeInput] = useState<string>('1000');
  const [calcMode, setCalcMode] = useState<'byStake1' | 'byTotal'>('byStake1');
  const [roundStakes, setRoundStakes] = useState<boolean>(true);

  // Auth
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authName, setAuthName] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState<boolean>(false);
  const [profileName, setProfileName] = useState<string>('');

  // Subscription / Stripe State
  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'pending' | 'expired'>('expired');
  const [subscriptionExpiresLabel, setSubscriptionExpiresLabel] = useState<string | null>(null);
  const [isProcessingStripe, setIsProcessingStripe] = useState<boolean>(false);
  const [stripeSuccessMessage, setStripeSuccessMessage] = useState<string | null>(null);
  const [stripeErrorMessage, setStripeErrorMessage] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Affiliate State
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [networkLevels, setNetworkLevels] = useState<NetworkLevel[]>(EMPTY_NETWORK_LEVELS);
  const [expandedLevels, setExpandedLevels] = useState<{ [key: number]: boolean }>({ 1: true, 2: false, 3: false });
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [totalPaidBalance, setTotalPaidBalance] = useState<number>(0);
  const [showPixModal, setShowPixModal] = useState<boolean>(false);
  const [pixKey, setPixKey] = useState<string>('');
  const [pixSuccess, setPixSuccess] = useState<boolean>(false);
  const [pixError, setPixError] = useState<string | null>(null);
  const [pixBusy, setPixBusy] = useState<boolean>(false);

  // Tutorial Video Modal State
  const [activeVideo, setActiveVideo] = useState<TutorialVideo | null>(null);

  // Floating Support Chat State
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'agent'; text: string; time: string }>>([
    {
      sender: 'agent',
      text: 'Olá! Bem-vindo ao suporte SUREBOT PRO 24/7. Como podemos acelerar suas operações de arbitragem esportiva hoje?',
      time: '11:15',
    },
  ]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatOpen]);

  const loadAccountData = async (userId: string) => {
    const [{ data: sub }, { data: invs }, { data: dash }, { data: profile }] = await Promise.all([
      supabase.from('subscriptions').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('billing_invoices').select('*').order('created_at', { ascending: false }).limit(12),
      supabase.rpc('get_affiliate_dashboard'),
      supabase.from('profiles').select('full_name, pix_key').eq('id', userId).maybeSingle(),
    ]);

    if (sub?.status === 'active' || sub?.status === 'pending' || sub?.status === 'expired') {
      setSubscriptionStatus(sub.status);
    } else {
      setSubscriptionStatus('expired');
    }

    if (sub?.expires_at) {
      const expires = new Date(sub.expires_at);
      setSubscriptionExpiresLabel(
        expires.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      );
    } else {
      setSubscriptionExpiresLabel(null);
    }

    if (invs && invs.length > 0) {
      setInvoices(
        invs.map((row: any) => ({
          id: String(row.stripe_invoice_id || row.id),
          date: new Date(row.paid_at || row.created_at).toLocaleDateString('pt-BR'),
          amount: Number(row.amount || 100),
          status: row.status === 'paid' ? 'paid' : 'pending',
          invoicePdfUrl: row.invoice_pdf_url || '#',
        }))
      );
    } else {
      setInvoices([]);
    }

    if (dash && typeof dash === 'object') {
      const payload = dash as {
        available_balance?: number;
        total_paid?: number;
        levels?: NetworkLevel[];
      };
      setAvailableBalance(Number(payload.available_balance || 0));
      setTotalPaidBalance(Number(payload.total_paid || 0));
      if (Array.isArray(payload.levels) && payload.levels.length === 3) {
        setNetworkLevels(payload.levels);
      } else {
        setNetworkLevels(EMPTY_NETWORK_LEVELS);
      }
    }

    if (profile?.full_name) setProfileName(profile.full_name);
    if (profile?.pix_key && !pixKey) setPixKey(profile.pix_key);
  };

  useEffect(() => {
    captureReferralFromUrl();

    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    if (checkout === 'success') {
      setActiveTab('assinatura');
      setStripeSuccessMessage(
        'Pagamento recebido. A assinatura é ativada pelo webhook Stripe em poucos segundos.'
      );
    } else if (checkout === 'cancel') {
      setActiveTab('assinatura');
      setStripeErrorMessage('Checkout Stripe cancelado. Nenhuma cobrança foi feita.');
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setSubscriptionStatus('expired');
      setInvoices([]);
      setNetworkLevels(EMPTY_NETWORK_LEVELS);
      setAvailableBalance(0);
      setTotalPaidBalance(0);
      setProfileName('');
      return;
    }
    loadAccountData(session.user.id).catch((err) => {
      console.info('Falha ao carregar conta:', err);
    });
  }, [session?.user?.id]);

  const pendingDeletes = useRef<Map<string, number>>(new Map());
  const selectedIdRef = useRef<string>('empty');
  selectedIdRef.current = selectedOpportunity.id;

  const cancelPendingDelete = (id: string) => {
    const timer = pendingDeletes.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      pendingDeletes.current.delete(id);
    }
  };

  const applyFeed = (incoming: SurebetOpportunity[]) => {
    for (const item of incoming) cancelPendingDelete(item.id);
    setOpportunities((prev) => {
      const next = mergeOpportunityList(prev, incoming, selectedIdRef.current);
      setSelectedOpportunity((cur) => pickSelection(cur, next));
      return next;
    });
    if (incoming[0]) {
      setCoveragePairLabel(`${incoming[0].bookmaker1.name} × ${incoming[0].bookmaker2.name}`);
    }
    setLastEventTime(
      new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    );
  };

  useEffect(() => {
    let cancelled = false;
    let bootstrapped = false;

    async function loadFeed() {
      try {
        const { data, error } = await supabase
          .from('surebets')
          .select('*')
          .order('profit_percent', { ascending: false })
          .limit(40);

        const fresh = !error && data
          ? data.filter(isFreshSurebetRow).map(mapSupabaseRecord)
          : [];

        if (cancelled) return;

        if (fresh.length > 0) {
          bootstrapped = true;
          applyFeed(fresh);
          setRealtimeStatus('connected');
          return;
        }

        if (bootstrapped) return;

        const liveRows = await fetchLiveCoverageOpportunities();
        if (cancelled) return;
        if (liveRows.length > 0) {
          bootstrapped = true;
          applyFeed(liveRows.map(mapScanRow));
        }
        setRealtimeStatus('simulated');
      } catch (err) {
        console.info('Falha ao carregar feed de surebets:', err);
      } finally {
        setFeedLoading(false);
      }
    }

    loadFeed();
    const poll = window.setInterval(loadFeed, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    try {
      channel = supabase
        .channel('public:surebets')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'surebets' },
          (payload) => {
            setLastEventTime(
              new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            );
            if ((payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && payload.new) {
              if (!isFreshSurebetRow(payload.new as any)) return;
              const mapped = mapSupabaseRecord(payload.new);
              cancelPendingDelete(mapped.id);
              setOpportunities((prev) =>
                sortOpportunities([mapped, ...prev.filter((item) => item.id !== mapped.id)])
              );
              setSelectedOpportunity((cur) => (cur.id === mapped.id ? mapped : cur));
              setRealtimeStatus('connected');
            } else if (payload.eventType === 'DELETE' && payload.old) {
              const oldId = String(
                (payload.old as { opportunity_key?: string; id?: string }).opportunity_key ||
                  payload.old.id
              );
              if (pendingDeletes.current.has(oldId)) return;
              const timer = window.setTimeout(() => {
                pendingDeletes.current.delete(oldId);
                setOpportunities((prev) => {
                  const next = prev.filter((item) => item.id !== oldId);
                  setSelectedOpportunity((cur) => pickSelection(cur, next));
                  return next;
                });
              }, 25000);
              pendingDeletes.current.set(oldId, timer);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') setRealtimeStatus('connected');
        });
    } catch (err) {
      console.warn('Realtime Supabase subscription error/fallback:', err);
      setRealtimeStatus('simulated');
    }

    return () => {
      pendingDeletes.current.forEach((timer) => window.clearTimeout(timer));
      pendingDeletes.current.clear();
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // --- ARBITRAGE CALCULATIONS ---
  const visibleOpportunities = useMemo(() => {
    if (feedFilter === 'live') return opportunities.filter((item) => item.isLive);
    return opportunities;
  }, [opportunities, feedFilter]);

  const liveCount = useMemo(() => opportunities.filter((item) => item.isLive).length, [opportunities]);
  const calcResults = useMemo(() => {
    const o1 = selectedOpportunity.bookmaker1.odd;
    const o2 = selectedOpportunity.bookmaker2.odd;
    const inv1 = 1 / o1;
    const inv2 = 1 / o2;
    const margin = inv1 + inv2;
    const guaranteedProfitPercent = ((1 - margin) / margin) * 100;

    let s1 = 0;
    let s2 = 0;
    let total = 0;

    if (calcMode === 'byStake1') {
      const parsedStake1 = parseFloat(stake1Input) || 0;
      s1 = parsedStake1;
      // standard inverse arbitrage formula: stake2 = (stake1 * odd1) / odd2
      s2 = o2 > 0 ? (s1 * o1) / o2 : 0;
      if (roundStakes) {
        s2 = Math.round(s2);
      }
      total = s1 + s2;
    } else {
      const parsedTotal = parseFloat(totalStakeInput) || 0;
      total = parsedTotal;
      if (margin > 0) {
        s1 = total * (inv1 / margin);
        s2 = total * (inv2 / margin);
        if (roundStakes) {
          s1 = Math.round(s1);
          s2 = total - s1; // keeps exact total
        }
      }
    }

    const return1 = s1 * o1;
    const return2 = s2 * o2;
    // Guaranteed return is min of the two (in case rounded)
    const guaranteedReturn = Math.min(return1, return2);
    const netProfit = guaranteedReturn - total;
    const netProfitPercentage = total > 0 ? (netProfit / total) * 100 : 0;

    return {
      stake1: s1,
      stake2: s2,
      totalInvested: total,
      return1,
      return2,
      guaranteedReturn,
      netProfit,
      netProfitPercentage: netProfitPercentage || guaranteedProfitPercent,
      margin,
    };
  }, [selectedOpportunity, stake1Input, totalStakeInput, calcMode, roundStakes]);

  // --- ACTIONS ---
  const affiliateLink = session?.user?.id
    ? `${window.location.origin}?ref=${session.user.id}`
    : `${window.location.origin}?ref=`;

  const requireAuth = () => {
    setAuthMode('login');
    setShowAuthModal(true);
  };

  const handleCopyAffiliateLink = () => {
    if (!session?.user?.id) {
      requireAuth();
      return;
    }
    navigator.clipboard.writeText(affiliateLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleAuthSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError(null);
    try {
      if (authMode === 'signup') {
        const referredBy = captureReferralFromUrl();
        const { error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
          options: {
            data: {
              full_name: authName.trim() || undefined,
              referred_by: referredBy || undefined,
            },
          },
        });
        if (error) throw error;
        setShowAuthModal(false);
        setStripeSuccessMessage(
          'Conta criada. Se o e-mail de confirmação estiver ativo no Supabase Auth, confirme antes de entrar.'
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword,
        });
        if (error) throw error;
        setShowAuthModal(false);
      }
      setAuthPassword('');
    } catch (err: any) {
      setAuthError(err?.message || 'Não foi possível autenticar.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleStripeCheckout = async () => {
    if (!session) {
      requireAuth();
      return;
    }
    setIsProcessingStripe(true);
    setStripeSuccessMessage(null);
    setStripeErrorMessage(null);
    try {
      const origin = window.location.origin;
      const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
        body: {
          successUrl: `${origin}/?checkout=success`,
          cancelUrl: `${origin}/?checkout=cancel`,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error('A Edge Function não retornou a URL do Stripe.');
      window.location.href = data.url;
    } catch (err: any) {
      console.error(err);
      setStripeErrorMessage(
        err?.message ||
          'Não foi possível abrir o Stripe. Confirme se as Edge Functions e o secret STRIPE_SECRET_KEY estão configurados.'
      );
    } finally {
      setIsProcessingStripe(false);
    }
  };

  const handleRequestPixWithdrawal = async () => {
    if (!session) {
      requireAuth();
      return;
    }
    if (!pixKey.trim()) return;
    setPixBusy(true);
    setPixError(null);
    try {
      const { data, error } = await supabase.functions.invoke('request-pix-withdrawal', {
        body: { pixKey: pixKey.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPixSuccess(true);
      setAvailableBalance(Number(data?.available_after ?? 0));
      if (session.user.id) {
        await loadAccountData(session.user.id);
      }
      setTimeout(() => {
        setShowPixModal(false);
        setPixSuccess(false);
      }, 1800);
    } catch (err: any) {
      setPixError(err?.message || 'Falha ao solicitar saque PIX.');
    } finally {
      setPixBusy(false);
    }
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    setChatMessages((prev) => [...prev, { sender: 'user', text: userMsg, time: now }]);
    setChatInput('');
    setIsTyping(true);

    setTimeout(() => {
      let reply = 'Entendido! Nossa equipe técnica está monitorando suas odds em tempo real. Se tiver dúvidas sobre a calculadora ou limites de casa, recomendo conferir nossa aba de Tutoriais.';
      const lower = userMsg.toLowerCase();
      if (lower.includes('calculadora') || lower.includes('arredondar') || lower.includes('ajuste')) {
        reply = 'A Calculadora Inteligente utiliza a fórmula de arbitragem inversa S2 = (S1 * Odd1) / Odd2. Ative sempre a opção "Arredondar" para não chamar atenção dos bots das casas!';
      } else if (lower.includes('saque') || lower.includes('pix') || lower.includes('afiliado')) {
        reply = 'Os saques de comissões via PIX são processados instantaneamente. O valor mínimo é de R$ 50,00 e cai na sua conta cadastrada em menos de 5 minutos.';
      } else if (lower.includes('stripe') || lower.includes('cartão') || lower.includes('plano')) {
        reply = 'Sua assinatura recorrente de R$ 100,00/mês é protegida com criptografia ponta a ponta pelo Stripe Billing com cancelamento simplificado a qualquer momento.';
      } else if (lower.includes('limitação') || lower.includes('bloqueio')) {
        reply = 'Dica de ouro anti-limitação: Aposte prioritariamente em mercados com alta liquidez (como Premier League e Champions) e nunca faça saques em horários incomuns após um green alto.';
      }

      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'agent',
          text: reply,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setIsTyping(false);
    }, 1100);
  };

  const toggleLevelAccordion = (levelNum: number) => {
    setExpandedLevels((prev) => ({
      ...prev,
      [levelNum]: !prev[levelNum],
    }));
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-800 font-sans flex flex-col selection:bg-[#FFD700] selection:text-black">
      {/* 1. TICKER HORIZONTAL ANIMADO (Topo) */}
      <header id="header-ticker" className="w-full bg-[#FFD700] text-black text-xs md:text-sm font-bold tracking-wide py-2.5 px-4 shadow-sm border-b border-amber-300 overflow-hidden relative z-40">
        <div className="flex items-center">
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-black text-[#FFD700] rounded-md uppercase text-[11px] font-extrabold tracking-wider mr-3 whitespace-nowrap shadow-xs">
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            LIVE FEED
          </div>
          <div className="overflow-hidden relative w-full flex-1">
            <div className="animate-marquee gap-8 items-center text-slate-900 font-semibold">
              <span className="inline-flex items-center gap-2">
                🟢 <strong className="text-black">NOVA SUREBET IDENTIFICADA:</strong> Real Madrid x Man City (Lucro 4.82% - Betano / Pinnacle)
              </span>
              <span className="text-black/30">•</span>
              <span className="inline-flex items-center gap-2">
                ⚡ <strong className="text-black">ALERTA DE ODD:</strong> C. Alcaraz vs J. Sinner bateu 6.45% de margem líquida garantida!
              </span>
              <span className="text-black/30">•</span>
              <span className="inline-flex items-center gap-2">
                💰 <strong className="text-black">SAQUE PIX APROVADO:</strong> Membro #491 sacou R$ 1.250,00 de comissões de afiliados.
              </span>
              <span className="text-black/30">•</span>
              <span className="inline-flex items-center gap-2">
                🛡️ <strong className="text-black">ANTI-LIMITAÇÃO:</strong> Calculadora com auto-arredondamento inteligente ativada no SUREBOT PRO.
              </span>
              <span className="text-black/30">•</span>
              <span className="inline-flex items-center gap-2">
                🟢 <strong className="text-black">SCANNER MULTI-CASAS:</strong> 48 casas de apostas sincronizadas via Supabase WebSockets.
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. BARRA DE NAVEGAÇÃO PRINCIPAL (Brand & Tabs) */}
      <nav id="main-navigation" className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 lg:px-8 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {/* LOGO & BRAND */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-[#FFD700] shadow-md shadow-[#8A2BE2]/10 border border-slate-800">
              <Zap className="w-6 h-6 fill-[#FFD700]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-slate-900">
                  Sure<span className="text-emerald-600">Green</span>Bet
                </span>
                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-[#8A2BE2] text-white shadow-xs tracking-wider">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Scanner de Arbitragem Esportiva & Inteligência</p>
            </div>
          </div>

          {/* TAB NAVIGATION BUTTONS */}
          <div id="nav-tabs" className="flex items-center p-1 bg-[#F0F2F5] rounded-xl border border-slate-200 shadow-inner overflow-x-auto max-w-full">
            <button
              id="tab-btn-operacoes"
              onClick={() => setActiveTab('operacoes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'operacoes'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Operações & Scanner
            </button>

            <button
              id="tab-btn-assinatura"
              onClick={() => setActiveTab('assinatura')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'assinatura'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <CreditCard className="w-4 h-4 text-amber-500" />
              Assinatura & Stripe
            </button>

            <button
              id="tab-btn-afiliados"
              onClick={() => setActiveTab('afiliados')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'afiliados'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Users className="w-4 h-4 text-[#8A2BE2]" />
              Afiliados Multinível
            </button>

            <button
              id="tab-btn-tutoriais"
              onClick={() => setActiveTab('tutoriais')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'tutoriais'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <PlayCircle className="w-4 h-4 text-blue-500" />
              Tutoriais
            </button>
          </div>

          {/* USER QUICK STATUS BADGE */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Supabase: <strong className="font-mono text-[11px] text-emerald-950">xqdxmqmvyofgletocqzb</strong></span>
            </div>
            {session ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700">
                  <User className="w-3.5 h-3.5 text-[#8A2BE2]" />
                  {profileName || session.user.email}
                </div>
                <button
                  id="btn-quick-deposit"
                  onClick={() => setActiveTab('assinatura')}
                  className="px-3 py-1.5 rounded-lg bg-[#FFD700] hover:bg-amber-400 text-slate-900 text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                >
                  <Award className="w-3.5 h-3.5" />
                  {subscriptionStatus === 'active' ? 'Plano PRO Ativo' : 'Assinar PRO'}
                </button>
                <button
                  onClick={handleSignOut}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  title="Sair"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthMode('login');
                  setShowAuthModal(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-[#FFD700] text-xs font-bold transition shadow-xs flex items-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                Entrar
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* 3. CONTEÚDO DINÂMICO PRINCIPAL BASEADO NA ABA ATIVA */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8">
        {/* =========================================================================
            ABA A) OPERAÇÕES (Scanner de Surebets + Calculadora Inteligente)
           ========================================================================= */}
        {activeTab === 'operacoes' && (
          <div id="view-operacoes" className="space-y-6">
            {/* BARRA SUPERIOR DE STATUS DO SCANNER */}
            <div className="bg-[#F0F2F5] border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-slate-800 shadow-xs border border-slate-200">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    Scanner de Arbitragem em Tempo Real
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                      {visibleOpportunities.length} Oportunidades
                    </span>
                    {liveCount > 0 && (
                      <span className="text-xs font-black px-2 py-0.5 rounded-full bg-red-500 text-white">
                        {liveCount} AO VIVO
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500 flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${realtimeStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
                    {coveragePairLabel} • {realtimeStatus === 'connected' ? 'Supabase Realtime' : 'Feed ao vivo'} • Atualizado: {lastEventTime}
                  </p>
                </div>
              </div>

              {/* CONTROLES DO SCANNER */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <div className="flex items-center p-1 bg-white rounded-xl border border-slate-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setFeedFilter('live')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      feedFilter === 'live' ? 'bg-[#8A2BE2] text-white' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Ao vivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedFilter('all')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      feedFilter === 'all' ? 'bg-[#8A2BE2] text-white' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Todas
                  </button>
                </div>

                <div className="hidden sm:flex items-center bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Risco Zero Garantido
                </div>
              </div>
            </div>

            {/* LAYOUT EM GRID: GRID DE OPORTUNIDADES (ESQUERDA) + CALCULADORA INTELIGENTE (DIREITA) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* COLUNA ESQUERDA: LISTA / GRID DE OPORTUNIDADES (7 colunas em telas grandes) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Oportunidades de Surebet Ativas
                  </span>
                  <span className="text-xs text-slate-500">
                    Clique em um card para carregar na Calculadora
                  </span>
                </div>

                <div className="space-y-4">
                  {feedLoading && visibleOpportunities.length === 0 && (
                    <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
                      <RefreshCw className="w-5 h-5 animate-spin text-[#8A2BE2] mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-700">Escaneando jogos ao vivo nas duas casas...</p>
                      <p className="text-xs text-slate-400 mt-1">{coveragePairLabel}</p>
                    </div>
                  )}

                  {!feedLoading && visibleOpportunities.length === 0 && (
                    <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
                      <Radio className="w-5 h-5 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-700">
                        {feedFilter === 'live'
                          ? 'Nenhum jogo ao vivo com surebet neste momento'
                          : 'Nenhuma oportunidade ativa'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        O scanner só mantém jogos frescos. Encerrados saem do feed em segundos, sem piscar.
                      </p>
                      {feedFilter === 'live' && opportunities.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setFeedFilter('all')}
                          className="mt-3 px-3 py-1.5 rounded-lg bg-[#FFD700] text-black text-xs font-black"
                        >
                          Ver pré-jogo
                        </button>
                      )}
                    </div>
                  )}

                  {visibleOpportunities.map((item) => {
                    const isSelected = selectedOpportunity.id === item.id;
                    return (
                      <div
                        key={item.id}
                        id={`card-surebet-${item.id}`}
                        onClick={() => setSelectedOpportunity(item)}
                        className={`bg-[#F0F2F5] rounded-2xl p-4 cursor-pointer transition-all duration-300 relative card-neon-glow ${
                          isSelected
                            ? 'ring-2 ring-[#8A2BE2] bg-white shadow-lg'
                            : 'hover:bg-white hover:shadow-md'
                        } ${item.status === 'closing_soon' ? 'opacity-80' : ''}`}
                      >
                        {/* CARD HEADER */}
                        <div className="flex items-center justify-between mb-3 border-b border-slate-200/70 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{item.sportIcon}</span>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">
                                  {item.sport} • {item.league}
                                </span>
                                {item.isLive && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-500 text-white text-[10px] font-black">
                                    <Radio className="w-3 h-3" />
                                    AO VIVO
                                  </span>
                                )}
                              </div>
                              <h3 className="text-sm md:text-base font-extrabold text-slate-900 leading-tight">
                                {item.event}
                              </h3>
                            </div>
                          </div>

                          {/* BADGE ROXO NEON DE LUCRO */}
                          <div className="text-right">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#8A2BE2] text-white font-black text-sm md:text-base shadow-md shadow-[#8A2BE2]/30 border border-purple-400/40">
                              <Sparkles className="w-4 h-4 text-[#FFD700]" />
                              +{item.profitPercentage.toFixed(2)}%
                            </div>
                            <div className="text-[10px] font-semibold text-slate-500 mt-1 flex items-center justify-end gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {item.startTime}
                            </div>
                          </div>
                        </div>

                        {/* COMPARAÇÃO DE CASAS DE APOSTAS (DUAS COLUNAS) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          {/* CASA 1 */}
                          <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs flex flex-col justify-between">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <span
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: item.bookmaker1.logoColor }}
                                ></span>
                                {item.bookmaker1.name}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-bold text-slate-600">
                                Casa 1
                              </span>
                            </div>

                            <p className="text-xs text-slate-500 font-medium mb-2 truncate">
                              {item.bookmaker1.market}
                            </p>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                              <span className="text-[11px] uppercase font-bold text-slate-400">Odd</span>
                              <span className="text-base font-black text-slate-900 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                                {item.bookmaker1.odd.toFixed(2)}
                              </span>
                            </div>

                            <a
                              href={item.bookmaker1.link}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="mt-2.5 w-full text-center py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center gap-1 transition"
                            >
                              Ir para {item.bookmaker1.name}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>

                          {/* CASA 2 */}
                          <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs flex flex-col justify-between">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <span
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: item.bookmaker2.logoColor }}
                                ></span>
                                {item.bookmaker2.name}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-bold text-slate-600">
                                Casa 2
                              </span>
                            </div>

                            <p className="text-xs text-slate-500 font-medium mb-2 truncate">
                              {item.bookmaker2.market}
                            </p>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                              <span className="text-[11px] uppercase font-bold text-slate-400">Odd</span>
                              <span className="text-base font-black text-slate-900 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                                {item.bookmaker2.odd.toFixed(2)}
                              </span>
                            </div>

                            <a
                              href={item.bookmaker2.link}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="mt-2.5 w-full text-center py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center gap-1 transition"
                            >
                              Ir para {item.bookmaker2.name}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>

                        {/* CARD FOOTER INFO */}
                        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                          <span>Identificado {item.foundAt}</span>
                          <span className="text-[#8A2BE2] font-bold flex items-center gap-1">
                            {isSelected ? '✓ Selecionado na Calculadora' : 'Clique para calcular auto-ajuste →'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* COLUNA DIREITA: CALCULADORA INTELIGENTE DE AUTO-AJUSTE (5 colunas em telas grandes) */}
              <div className="lg:col-span-5 sticky top-24 space-y-4">
                <div id="calculator-panel" className="bg-[#F0F2F5] border-2 border-[#8A2BE2]/40 rounded-2xl p-5 shadow-xl shadow-[#8A2BE2]/10 relative overflow-hidden">
                  {/* CABEÇALHO DA CALCULADORA */}
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#FFD700] text-black flex items-center justify-center shadow-xs">
                        <Calculator className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                          Calculadora de Auto-Ajuste
                        </h3>
                        <p className="text-[11px] text-slate-500 font-medium">Fórmula de Arbitragem Inversa</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-[#8A2BE2]/10 text-[#8A2BE2] font-black text-xs">
                      +<span>{calcResults.netProfitPercentage.toFixed(2)}</span>% ROI
                    </span>
                  </div>

                  {/* EVENTO SELECIONADO ATUALMENTE */}
                  <div className="bg-white rounded-xl p-3 border border-slate-200 mb-4">
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                      Evento em Análise
                    </span>
                    <h4 className="text-xs md:text-sm font-extrabold text-slate-900 truncate">
                      {selectedOpportunity.event}
                    </h4>
                    <div className="flex items-center justify-between text-xs text-slate-600 mt-1">
                      <span>{selectedOpportunity.bookmaker1.name} (Odd {selectedOpportunity.bookmaker1.odd.toFixed(2)})</span>
                      <span className="text-slate-400 font-bold">VS</span>
                      <span>{selectedOpportunity.bookmaker2.name} (Odd {selectedOpportunity.bookmaker2.odd.toFixed(2)})</span>
                    </div>
                  </div>

                  {/* SELETOR DE MODO DE CÁLCULO */}
                  <div className="flex items-center p-1 bg-white rounded-xl border border-slate-200 mb-4 text-xs font-bold">
                    <button
                      id="calc-mode-stake1"
                      onClick={() => setCalcMode('byStake1')}
                      className={`flex-1 py-1.5 rounded-lg text-center transition ${
                        calcMode === 'byStake1' ? 'bg-[#FFD700] text-black font-extrabold shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Por Valor na Casa 1
                    </button>
                    <button
                      id="calc-mode-total"
                      onClick={() => setCalcMode('byTotal')}
                      className={`flex-1 py-1.5 rounded-lg text-center transition ${
                        calcMode === 'byTotal' ? 'bg-[#FFD700] text-black font-extrabold shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Por Total Investido
                    </button>
                  </div>

                  {/* CAMPOS DE ENTRADA INTELIGENTES
                      Os dois modos ficam montados (hidden) para o React não
                      remover nós de texto que o tradutor do Chrome possa ter
                      envelopado — isso gerava tela branca (removeChild). */}
                  <div className="space-y-3 mb-4">
                    <div className={calcMode === 'byStake1' ? '' : 'hidden'} aria-hidden={calcMode !== 'byStake1'}>
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                        <span>Aposta na Casa 1 ({selectedOpportunity.bookmaker1.name})</span>
                        <span className="text-[11px] text-slate-400 font-normal">Digite para auto-ajustar a Casa 2</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                        <input
                          id="input-stake-1"
                          type="number"
                          value={stake1Input}
                          onChange={(e) => setStake1Input(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#8A2BE2] focus:ring-1 focus:ring-[#8A2BE2]"
                          placeholder="500"
                        />
                      </div>
                    </div>
                    <div className={calcMode === 'byTotal' ? '' : 'hidden'} aria-hidden={calcMode !== 'byTotal'}>
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                        <span>Investimento Total Desejado</span>
                        <span className="text-[11px] text-slate-400 font-normal">Distribuição exata de risco zero</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                        <input
                          id="input-total-stake"
                          type="number"
                          value={totalStakeInput}
                          onChange={(e) => setTotalStakeInput(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#8A2BE2] focus:ring-1 focus:ring-[#8A2BE2]"
                          placeholder="1000"
                        />
                      </div>
                    </div>

                    {/* BOTÕES RÁPIDOS DE VALOR */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Rápido:</span>
                      {[100, 250, 500, 1000, 2500].map((val) => (
                        <button
                          key={val}
                          onClick={() => {
                            if (calcMode === 'byStake1') setStake1Input(val.toString());
                            else setTotalStakeInput(val.toString());
                          }}
                          className="px-2 py-1 rounded-md bg-white hover:bg-slate-100 text-[11px] font-bold text-slate-700 border border-slate-200 transition"
                        >
                          R$ {val}
                        </button>
                      ))}
                    </div>

                    {/* TOGGLE DE ARREDONDAMENTO ANTI-LIMITAÇÃO */}
                    <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 text-xs">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <div>
                          <span className="font-bold text-slate-800">Arredondar Apostas (Anti-Ban)</span>
                          <p className="text-[10px] text-slate-400">Evita centavos quebrados nas casas recreativas</p>
                        </div>
                      </div>
                      <button
                        id="toggle-round-stakes"
                        onClick={() => setRoundStakes(!roundStakes)}
                        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                          roundStakes ? 'bg-[#8A2BE2]' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform absolute top-1 ${
                            roundStakes ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* RESULTADOS DA MATEMÁTICA DE ARBITRAGEM */}
                  <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3 mb-4">
                    {/* Casa 1 Stake & Retorno */}
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                      <div>
                        <span className="font-bold text-slate-700">Apostar em {selectedOpportunity.bookmaker1.name}:</span>
                        <p className="text-[10px] text-slate-400">{selectedOpportunity.bookmaker1.market} @ {selectedOpportunity.bookmaker1.odd.toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-slate-900">
                          R$ {calcResults.stake1.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <p className="text-[10px] text-emerald-600 font-semibold">
                          Retorna R$ {calcResults.return1.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    {/* Casa 2 Stake & Retorno */}
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                      <div>
                        <span className="font-bold text-slate-700">Apostar em {selectedOpportunity.bookmaker2.name}:</span>
                        <p className="text-[10px] text-slate-400">{selectedOpportunity.bookmaker2.market} @ {selectedOpportunity.bookmaker2.odd.toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-slate-900">
                          R$ {calcResults.stake2.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <p className="text-[10px] text-emerald-600 font-semibold">
                          Retorna R$ {calcResults.return2.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    {/* TOTAL INVESTIDO & LUCRO LÍQUIDO REALIZADO */}
                    <div className="pt-1 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold uppercase text-slate-400 block">Total Investido</span>
                        <span className="text-base font-extrabold text-slate-800">
                          R$ {calcResults.totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-black uppercase text-emerald-700 block">Lucro Líquido Realizado</span>
                        <span className="text-lg font-black text-emerald-600">
                          +R$ {calcResults.netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* BOTÕES DE REDIRECIONAMENTO DEEP LINK */}
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      id="btn-link-bookmaker-1"
                      href={selectedOpportunity.id === 'empty' ? undefined : selectedOpportunity.bookmaker1.link}
                      target="_blank"
                      rel="noreferrer"
                      className={`py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold text-center flex items-center justify-center gap-1.5 transition shadow-sm ${
                        selectedOpportunity.id === 'empty' ? 'pointer-events-none opacity-40' : ''
                      }`}
                    >
                      Abrir {selectedOpportunity.bookmaker1.name}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <a
                      id="btn-link-bookmaker-2"
                      href={selectedOpportunity.id === 'empty' ? undefined : selectedOpportunity.bookmaker2.link}
                      target="_blank"
                      rel="noreferrer"
                      className={`py-2.5 px-3 rounded-xl bg-[#FFD700] hover:bg-amber-400 text-black text-xs font-black text-center flex items-center justify-center gap-1.5 transition shadow-sm ${
                        selectedOpportunity.id === 'empty' ? 'pointer-events-none opacity-40' : ''
                      }`}
                    >
                      Abrir {selectedOpportunity.bookmaker2.name}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            ABA B) ASSINATURA & STRIPE (Pagamento de R$ 100/mês + Histórico)
           ========================================================================= */}
        {activeTab === 'assinatura' && (
          <div id="view-assinatura" className="max-w-4xl mx-auto space-y-6">
            {/* STATUS DA ASSINATURA BANNER */}
            <div className="bg-[#F0F2F5] border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-xs border border-slate-200 text-amber-500">
                  <CreditCard className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Plano SUREBOT PRO
                    </span>
                    <span
                      id="badge-subscription-status"
                      className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                        subscriptionStatus === 'active'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : subscriptionStatus === 'pending'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-red-100 text-red-800 border border-red-300'
                      }`}
                    >
                      {subscriptionStatus === 'active' ? '● Ativa' : subscriptionStatus === 'pending' ? '● Pendente' : '● Expirada'}
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900">
                    Assinatura Recorrente Mensal
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {subscriptionStatus === 'active'
                      ? `Próxima renovação automática: ${subscriptionExpiresLabel || 'via Stripe'} via Cartão de Crédito`
                      : 'Renove para continuar com acesso irrestrito ao scanner e calculadora'}
                  </p>
                </div>
              </div>

              {!session && authReady && (
                <button
                  onClick={() => {
                    setAuthMode('login');
                    setShowAuthModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-[#FFD700] text-xs font-black"
                >
                  Entre para gerenciar a assinatura
                </button>
              )}
            </div>

            {stripeSuccessMessage && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-4 rounded-xl text-sm font-semibold flex items-center justify-between">
                <span>{stripeSuccessMessage}</span>
                <button onClick={() => setStripeSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {stripeErrorMessage && (
              <div className="bg-red-50 border border-red-300 text-red-900 p-4 rounded-xl text-sm font-semibold flex items-center justify-between">
                <span>{stripeErrorMessage}</span>
                <button onClick={() => setStripeErrorMessage(null)} className="text-red-700 hover:text-red-900">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* CHECKOUT CARD INTEGRADO (STRIPE BILLING SIMULATION) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              <div className="md:col-span-7 bg-[#F0F2F5] border border-slate-200 rounded-2xl p-6 space-y-5">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold mb-2">
                    🔥 OFERTA PROMOCIONAL EXCLUSIVA
                  </div>
                  <h3 className="text-lg font-black text-slate-900">
                    Acesso Ilimitado SUREBOT PRO
                  </h3>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-xs text-slate-400 line-through font-bold">De R$ 200,00</span>
                    <span className="text-3xl font-black text-slate-900">R$ 100,00</span>
                    <span className="text-xs font-bold text-slate-500">/mês (50% OFF)</span>
                  </div>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-slate-200 text-xs text-slate-700">
                  <div className="flex items-center gap-2 font-medium">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Scanner 24/7 com mais de 48 casas de apostas sincronizadas</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Calculadora Inteligente de Auto-Ajuste com Anti-Limitação</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Conexão Supabase Realtime via WebSockets de ultra baixa latência</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Participação automática na Rede de Afiliados Multinível de 3 Níveis</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Suporte VIP prioritário integrado via chat 24/7</span>
                  </div>
                </div>

                {/* BOTÃO INTEGRADO STRIPE */}
                <div className="pt-2">
                  <button
                    id="btn-stripe-checkout"
                    disabled={isProcessingStripe}
                    onClick={handleStripeCheckout}
                    className="w-full py-3.5 px-4 rounded-xl bg-[#FFD700] hover:bg-amber-400 active:scale-[0.99] text-black font-black text-sm flex items-center justify-center gap-2 transition shadow-md shadow-amber-400/20 cursor-pointer disabled:opacity-50"
                  >
                    {isProcessingStripe ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-black" />
                        Conectando com Stripe Billing...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        Pagar R$ 100 com Stripe (Checkout Seguro)
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-slate-400 text-center mt-2 flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Processado por Supabase Edge Function & Stripe Inc. Cancele quando quiser.
                  </p>
                </div>
              </div>

              {/* HISTÓRICO DE FATURAS STRIPE */}
              <div className="md:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                    Histórico de Faturas
                  </h4>
                  <span className="text-[11px] text-slate-400 font-medium">Stripe Invoices</span>
                </div>

                <div className="space-y-3">
                  {invoices.length === 0 && (
                    <p className="text-xs text-slate-500">
                      Nenhuma fatura Stripe ainda. Elas aparecem automaticamente após o webhook `invoice.paid`.
                    </p>
                  )}
                  {invoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-3 rounded-xl bg-[#F0F2F5] border border-slate-200/80 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-extrabold text-slate-900 block">R$ {inv.amount.toFixed(2)}</span>
                        <span className="text-[11px] text-slate-500">{inv.date} • {inv.id}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase">
                          Paga
                        </span>
                        <button
                          onClick={() => {
                            if (inv.invoicePdfUrl && inv.invoicePdfUrl !== '#') {
                              window.open(inv.invoicePdfUrl, '_blank', 'noopener,noreferrer');
                            }
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-white transition"
                          title="Baixar PDF do Recibo"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            ABA C) AFILIADOS MULTINÍVEL (Rede 3 Níveis + Comissões + Saque PIX)
           ========================================================================= */}
        {activeTab === 'afiliados' && (
          <div id="view-afiliados" className="space-y-6">
            {/* TOPO: LINK DE INDICAÇÃO ÚNICO */}
            <div className="bg-[#F0F2F5] border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Share2 className="w-4 h-4 text-[#8A2BE2]" />
                  <span className="text-xs font-extrabold uppercase text-[#8A2BE2] tracking-wider">
                    Programa de Parceiros SureGreenBet
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-900">
                  Seu Link Exclusivo de Indicação
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Receba comissões mensais perpétuas sobre todas as mensalidades pagas pela sua rede de até 3 níveis.
                </p>
              </div>

              {/* INPUT DE COPIAR LINK */}
              <div className="w-full md:w-auto flex-1 max-w-md">
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-xs">
                  <input
                    id="input-affiliate-link"
                    type="text"
                    readOnly
                    value={affiliateLink}
                    className="bg-transparent px-3 text-xs font-bold text-slate-800 w-full focus:outline-none"
                  />
                  <button
                    id="btn-copy-affiliate-link"
                    onClick={handleCopyAffiliateLink}
                    className="px-4 py-2 rounded-lg bg-[#FFD700] hover:bg-amber-400 text-black text-xs font-black flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-800" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copiar Link
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* CARDS DO PAINEL DE GANHOS & SALDO */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* SALDO DISPONÍVEL */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase text-slate-500">Saldo Disponível para Saque</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Wallet className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <span className="text-2xl lg:text-3xl font-black text-emerald-600">
                    R$ {availableBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-1">Disponível para transferência imediata via PIX</p>
                </div>
                <button
                  id="btn-open-pix-modal"
                  disabled={availableBalance < 50}
                  onClick={() => {
                    if (!session) {
                      requireAuth();
                      return;
                    }
                    setPixError(null);
                    setShowPixModal(true);
                  }}
                  className="mt-4 w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-[#FFD700] text-xs font-extrabold flex items-center justify-center gap-1.5 transition disabled:opacity-40 cursor-pointer"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  Solicitar Saque via PIX
                </button>
              </div>

              {/* TOTAL JÁ PAGO EM COMISSÕES */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase text-slate-500">Total Já Pago em Comissões</span>
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-[#8A2BE2] flex items-center justify-center">
                    <Award className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <span className="text-2xl lg:text-3xl font-black text-slate-900">
                    R$ {totalPaidBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-1">Acumulado total transferido com sucesso</p>
                </div>
                <div className="mt-4 py-2 px-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Sem limites de saques ou taxas
                </div>
              </div>

              {/* RECORRÊNCIA MENSAL ESTIMADA */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase text-slate-500">Renda Recorrente Mensal</span>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <span className="text-2xl lg:text-3xl font-black text-slate-900">
                    R${' '}
                    {networkLevels
                      .reduce((acc, lvl) => acc + lvl.monthlyRevenue, 0)
                      .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    <span className="text-xs text-slate-500 font-bold">/mês</span>
                  </span>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Baseado em {networkLevels.reduce((acc, lvl) => acc + lvl.activeCount, 0)} membros ativos na rede
                  </p>
                </div>
                <div className="mt-4 py-2 px-3 rounded-xl bg-[#FFD700]/15 border border-[#FFD700]/30 text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  {networkLevels.reduce((acc, lvl) => acc + lvl.totalMembers, 0)} membros em toda a árvore
                </div>
              </div>
            </div>

            {/* ÁRVORE DE REDE MULTINÍVEL (3 NÍVEIS COM SANFONAS / ACCORDIONS) */}
            <div className="bg-[#F0F2F5] border border-slate-200 rounded-2xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#8A2BE2]" />
                    Estrutura da Rede em 3 Níveis de Comissão
                  </h3>
                  <p className="text-xs text-slate-500">
                    Regra matemática: 1º Nível (10% = R$ 10) | 2º Nível (3% = R$ 3) | 3º Nível (2% = R$ 2)
                  </p>
                </div>
                <span className="text-xs font-extrabold text-[#8A2BE2] bg-[#8A2BE2]/10 px-3 py-1 rounded-full w-fit">
                  Total de 15% em Comissões Distribuídas
                </span>
              </div>

              <div className="space-y-3">
                {networkLevels.map((lvl) => {
                  const isExpanded = expandedLevels[lvl.level];
                  return (
                    <div
                      key={lvl.level}
                      id={`accordion-level-${lvl.level}`}
                      className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs transition"
                    >
                      {/* ACCORDION HEADER */}
                      <div
                        onClick={() => toggleLevelAccordion(lvl.level)}
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 transition select-none"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#8A2BE2] text-white flex items-center justify-center font-black text-sm shadow-xs">
                            {lvl.level}º
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-extrabold text-slate-900">
                                Nível {lvl.level} ({lvl.percentage}% da Mensalidade)
                              </h4>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                                R$ {lvl.commissionPerActive.toFixed(2)}/mês por ativo
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">
                              {lvl.activeCount} membros ativos ({lvl.totalMembers} cadastrados)
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                            <span className="text-xs font-bold uppercase text-slate-400 block">Comissão Mensal</span>
                            <span className="text-sm font-black text-emerald-600">
                              +R$ {lvl.monthlyRevenue.toFixed(2)}/mês
                            </span>
                          </div>
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>
                      </div>

                      {/* ACCORDION CONTENT: LISTA DE MEMBROS */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 p-4 bg-slate-50/50 space-y-2">
                          <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-2">
                            Membros Recentes Deste Nível
                          </div>

                          <div className="space-y-2">
                            {lvl.members.length === 0 && (
                              <p className="text-xs text-slate-500">Nenhum indicado neste nível ainda.</p>
                            )}
                            {lvl.members.map((member) => (
                              <div
                                key={member.id}
                                className="bg-white p-3 rounded-lg border border-slate-200/80 flex items-center justify-between text-xs"
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[10px]">
                                    {member.avatar}
                                  </div>
                                  <div>
                                    <span className="font-extrabold text-slate-800 block">{member.name}</span>
                                    <span className="text-[10px] text-slate-400">Entrou em: {member.joinedDate}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                      member.status === 'active'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-slate-200 text-slate-600'
                                    }`}
                                  >
                                    {member.status === 'active' ? 'Ativo' : 'Pendente'}
                                  </span>
                                  <span className="font-black text-slate-900">
                                    +R$ {member.monthlyCommission.toFixed(2)}/mês
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* MODAL DE SAQUE PIX */}
            {showPixModal && (
              <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-emerald-600" />
                      Solicitar Saque de Comissões PIX
                    </h3>
                    <button
                      onClick={() => setShowPixModal(false)}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {pixSuccess ? (
                    <div className="text-center py-6 space-y-2">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                        <Check className="w-6 h-6" />
                      </div>
                      <h4 className="text-lg font-black text-slate-900">Solicitação Enviada!</h4>
                      <p className="text-xs text-slate-500">
                        O saque PIX foi registrado no banco. O crédito na chave ocorre após o processamento operacional.
                      </p>
                    </div>
                  ) : (
                    <>
                      {pixError && (
                        <p className="text-xs font-semibold text-red-600">{pixError}</p>
                      )}
                      <div>
                        <span className="text-xs text-slate-400 block">Valor a Resgatar:</span>
                        <span className="text-2xl font-black text-emerald-600">
                          R$ {availableBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <p className="text-[11px] text-slate-400 mt-1">Mínimo de R$ 50,00</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Chave PIX (CPF, E-mail, Telefone ou Aleatória)
                        </label>
                        <input
                          id="input-pix-key"
                          type="text"
                          value={pixKey}
                          onChange={(e) => setPixKey(e.target.value)}
                          placeholder="Digite sua chave PIX"
                          className="w-full bg-[#F0F2F5] border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#8A2BE2]"
                        />
                      </div>

                      <div className="pt-2 flex items-center gap-2">
                        <button
                          onClick={() => setShowPixModal(false)}
                          className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                        >
                          Cancelar
                        </button>
                        <button
                          id="btn-confirm-pix-withdrawal"
                          onClick={handleRequestPixWithdrawal}
                          disabled={!pixKey.trim() || pixBusy}
                          className="flex-1 py-2.5 rounded-xl bg-[#FFD700] hover:bg-amber-400 text-black text-xs font-black transition disabled:opacity-50 cursor-pointer"
                        >
                          {pixBusy ? 'Registrando...' : 'Confirmar Saque'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            ABA D) TUTORIAIS (Grade de Vídeos com Players e Notas de Aula)
           ========================================================================= */}
        {activeTab === 'tutoriais' && (
          <div id="view-tutoriais" className="space-y-6">
            <div className="bg-[#F0F2F5] border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Tv className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-extrabold uppercase text-blue-600 tracking-wider">
                    Academia SUREBOT PRO
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-900">
                  Tutoriais Oficiais & Estratégias Avançadas
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Aulas passo a passo sobre a calculadora inteligente, gestão de banca, proteção anti-limitação e escala de afiliados.
                </p>
              </div>

              <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#FFD700]" />
                4 Módulos Prontos para Estudo
              </div>
            </div>

            {/* GRADE DE CARDS DE VÍDEOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {TUTORIAL_VIDEOS.map((video) => (
                <div
                  key={video.id}
                  id={`card-video-${video.id}`}
                  className="bg-[#F0F2F5] rounded-2xl overflow-hidden border border-slate-200 shadow-xs hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    {/* SIMULAÇÃO DE PLAYER DE VÍDEO COM THUMBNAIL */}
                    <div
                      onClick={() => setActiveVideo(video)}
                      className={`h-48 bg-gradient-to-tr ${video.thumbnailColor} p-4 flex flex-col justify-between relative cursor-pointer group`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-full bg-black/60 text-white text-[10px] font-extrabold uppercase backdrop-blur-xs">
                          {video.category}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-black/60 text-white text-xs font-bold">
                          {video.duration}
                        </span>
                      </div>

                      {/* PLAY BUTTON ICON */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-14 h-14 rounded-full bg-white/90 group-hover:bg-[#FFD700] text-slate-900 flex items-center justify-center shadow-lg transition-transform transform group-hover:scale-110">
                          <PlayCircle className="w-8 h-8 fill-current text-slate-900" />
                        </div>
                      </div>

                      <div className="text-[11px] text-white/90 font-medium">
                        {video.views}
                      </div>
                    </div>

                    {/* INFOS DO VÍDEO */}
                    <div className="p-5 space-y-3">
                      <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                        {video.title}
                      </h3>
                      <p className="text-xs text-slate-600 line-clamp-2">
                        {video.summary}
                      </p>

                      <div className="space-y-1.5 pt-2 border-t border-slate-200/80">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          Tópicos Abordados:
                        </span>
                        {video.keyPoints.map((pt, i) => (
                          <div key={i} className="text-xs text-slate-700 flex items-center gap-1.5 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#8A2BE2]"></span>
                            <span>{pt}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-5 pt-0">
                    <button
                      id={`btn-watch-${video.id}`}
                      onClick={() => setActiveVideo(video)}
                      className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-[#FFD700] text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <PlayCircle className="w-4 h-4" />
                      Assistir Aula Completa
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* MODAL DE PLAYER DE VÍDEO INTERATIVO */}
            {activeVideo && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden border border-slate-200 shadow-2xl">
                  <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-[#FFD700] uppercase tracking-wider">
                        {activeVideo.category}
                      </span>
                      <h4 className="text-sm font-extrabold truncate max-w-md">{activeVideo.title}</h4>
                    </div>
                    <button
                      onClick={() => setActiveVideo(null)}
                      className="text-slate-400 hover:text-white p-1 rounded-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* VÍDEO PLAYER SIMULADO */}
                  <div className="w-full aspect-video bg-black flex items-center justify-center text-white relative">
                    <div className="text-center p-6 space-y-3">
                      <div className="w-16 h-16 rounded-full bg-[#FFD700] text-black flex items-center justify-center mx-auto shadow-lg animate-pulse">
                        <PlayCircle className="w-10 h-10 fill-current" />
                      </div>
                      <p className="text-sm font-bold">Transmitindo aula em alta definição 1080p</p>
                      <span className="text-xs text-slate-400">
                        {activeVideo.duration} • SUREBOT PRO Learning Hub
                      </span>
                    </div>
                  </div>

                  <div className="p-5 space-y-3">
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                      {activeVideo.summary}
                    </p>
                    <div className="p-3 bg-[#F0F2F5] rounded-xl text-xs space-y-1">
                      <span className="font-extrabold text-slate-900 block">Resumo do Instrutor:</span>
                      <p className="text-slate-600">
                        "Sempre execute as apostas na ordem indicada pela calculadora e utilize os valores arredondados para manter sua conta segura nas casas recreativas."
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 4. CHAT DE SUPORTE FLUTUANTE INTEGRADO COM GLASSMORPHISM & SOMBRA ROXA */}
      <div id="floating-support-container" className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {/* JANELA DO CHAT ABERTA */}
        {isChatOpen && (
          <div
            id="chat-widget-window"
            className="mb-3 w-80 sm:w-96 h-[460px] glassmorphism-support border border-purple-200/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300"
            style={{
              boxShadow: '0 15px 35px -5px rgba(138, 43, 226, 0.35), 0 4px 15px rgba(0, 0, 0, 0.08)',
            }}
          >
            {/* CHAT HEADER */}
            <div className="p-3.5 bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white flex items-center justify-between border-b border-purple-800/40">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-[#8A2BE2] flex items-center justify-center text-white font-black text-xs">
                    SP
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-900"></span>
                </div>
                <div>
                  <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                    Suporte SUREBOT PRO
                    <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-[#FFD700] text-black">24/7</span>
                  </h4>
                  <p className="text-[10px] text-emerald-400 font-semibold">Online agora • Resposta instantânea</p>
                </div>
              </div>
              <button
                id="btn-close-chat"
                onClick={() => setIsChatOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* CHAT MESSAGES AREA */}
            <div className="flex-1 p-3.5 overflow-y-auto space-y-3 text-xs">
              {chatMessages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[82%] p-3 rounded-xl leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-[#8A2BE2] text-white rounded-br-none shadow-xs'
                        : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-none shadow-xs font-medium'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[9px] text-slate-400 mt-1 px-1 font-semibold">{msg.time}</span>
                </div>
              ))}

              {isTyping && (
                <div className="flex items-center gap-1.5 bg-white p-2 rounded-xl border border-slate-200 w-fit text-[11px] text-slate-500 font-medium">
                  <span className="w-2 h-2 rounded-full bg-[#8A2BE2] animate-bounce"></span>
                  <span className="w-2 h-2 rounded-full bg-[#8A2BE2] animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-2 h-2 rounded-full bg-[#8A2BE2] animate-bounce [animation-delay:0.4s]"></span>
                  <span className="text-[10px] text-slate-400 ml-1">Especialista digitando...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* ATALHOS RÁPIDOS DE DÚVIDAS */}
            <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200/60 flex items-center gap-1.5 overflow-x-auto text-[10px]">
              <button
                onClick={() => setChatInput('Como usar o auto-ajuste da calculadora?')}
                className="px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 whitespace-nowrap"
              >
                Calculadora?
              </button>
              <button
                onClick={() => setChatInput('Como solicitar meu saque PIX de afiliados?')}
                className="px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 whitespace-nowrap"
              >
                Saque PIX?
              </button>
              <button
                onClick={() => setChatInput('Como funciona o anti-limitação?')}
                className="px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 whitespace-nowrap"
              >
                Anti-Limitação?
              </button>
            </div>

            {/* CHAT INPUT FORM */}
            <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
              <input
                id="input-chat-message"
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Digite sua dúvida técnica..."
                className="flex-1 bg-[#F0F2F5] border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#8A2BE2]"
              />
              <button
                id="btn-send-chat-message"
                onClick={handleSendMessage}
                disabled={!chatInput.trim()}
                className="p-2 rounded-xl bg-[#8A2BE2] hover:bg-purple-700 text-white transition disabled:opacity-40 cursor-pointer shadow-xs"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* BOTÃO FLUTUANTE PERMANENTE COM GLASSMORPHISM E SOMBRA ROXA */}
        <button
          id="btn-floating-support-toggle"
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="glassmorphism-support border-2 border-[#8A2BE2] text-[#8A2BE2] hover:text-white hover:bg-[#8A2BE2] p-3.5 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center gap-2 group cursor-pointer"
          style={{
            boxShadow: '0 10px 25px -5px rgba(138, 43, 226, 0.5), 0 0 15px rgba(138, 43, 226, 0.25)',
          }}
          title="Suporte Online 24/7"
        >
          {isChatOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <>
              <MessageCircle className="w-6 h-6 fill-current" />
              <span className="hidden sm:inline-block text-xs font-extrabold text-slate-900 group-hover:text-white pr-1">
                Suporte 24/7
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </>
          )}
        </button>
      </div>

      {showAuthModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <LogIn className="w-5 h-5 text-[#8A2BE2]" />
                {authMode === 'login' ? 'Entrar no SUREBOT PRO' : 'Criar conta'}
              </h3>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              {authMode === 'signup' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nome</label>
                  <input
                    type="text"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    className="w-full bg-[#F0F2F5] border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#8A2BE2]"
                    placeholder="Seu nome"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full bg-[#F0F2F5] border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#8A2BE2]"
                  placeholder="voce@email.com"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Senha</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full bg-[#F0F2F5] border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#8A2BE2]"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              {authError && <p className="text-xs font-semibold text-red-600">{authError}</p>}
              <button
                type="submit"
                disabled={authBusy}
                className="w-full py-3 rounded-xl bg-[#FFD700] hover:bg-amber-400 text-black text-sm font-black disabled:opacity-50"
              >
                {authBusy ? 'Aguarde...' : authMode === 'login' ? 'Entrar' : 'Cadastrar'}
              </button>
            </form>

            <button
              onClick={() => {
                setAuthError(null);
                setAuthMode(authMode === 'login' ? 'signup' : 'login');
              }}
              className="w-full text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              {authMode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
