import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  LogOut, CheckCircle2, Eye, Info, Filter, Check, 
  Menu, X, Lock, Star, Target, ArrowLeft, BarChart3, Mail, List, 
  Save, CreditCard, AlertTriangle, Loader2, Archive, Play, 
  ChevronRight, ChevronLeft, Layout, FolderOpen, Folder, Clock,
  Trash2, Edit, Flame, Flag, AlertOctagon, ShieldAlert, Server, Zap, Tags // <--- Tags IMPORTADO
} from 'lucide-react';

// --- CONFIGURAÇÃO ---
const SUPABASE_URL = 'https://jiewnyqkpbxvdscmnzhj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppZXdueXFrcGJ4dmRzY21uemhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwOTU4MjMsImV4cCI6MjA4MjY3MTgyM30.jqEe1E42mVgSmzUnUjPtD_JaruUvj6vMe01Sx8rLT1Y';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, storage: window.localStorage, autoRefreshToken: true, detectSessionInUrl: true }
});

// --- FUNÇÃO AUXILIAR DE EMBARALHAMENTO ---
function embaralharQuestoes(listaQuestoes: any[]) {
  return listaQuestoes.map(q => {
    // Se não tiver opções (ex: discursiva) ou admin estiver editando, não mexe
    if (!q.opcoes || q.opcoes.length === 0) return q;

    // 1. Cria um array de objetos para rastrear qual é a correta
    const opcoesMapeadas = q.opcoes.map((texto: string, index: number) => ({
      texto,
      ehCorreta: index === q.resposta_correta
    }));

    // 2. Algoritmo de embaralhamento (Fisher-Yates)
    for (let i = opcoesMapeadas.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opcoesMapeadas[i], opcoesMapeadas[j]] = [opcoesMapeadas[j], opcoesMapeadas[i]];
    }

    // 3. Reconstrói a questão com a nova ordem e o novo índice da resposta certa
    return {
      ...q,
      opcoes: opcoesMapeadas.map((o: any) => o.texto),
      resposta_correta: opcoesMapeadas.findIndex((o: any) => o.ehCorreta)
    };
  });
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [assinatura, setAssinatura] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sessaoInvalida, setSessaoInvalida] = useState(false);
  const [viewMode, setViewMode] = useState<'home' | 'feed'>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Streak (Foguinho)
  const [streak, setStreak] = useState(0);

  // Reporte de Erro (Estado do Modal)
  const [reportingId, setReportingId] = useState<number | null>(null);

  // Auth
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState(''); 
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); 

  // --- FILTROS ---
  const [allData, setAllData] = useState<any[]>([]); 
  const [filtroMapa, setFiltroMapa] = useState<any>({}); 
  const [activeDisc, setActiveDisc] = useState<string | null>(null); 
  const [activeTema, setActiveTema] = useState<string | null>(null); 

  // Seleções
  const [selectedDiscs, setSelectedDiscs] = useState<string[]>([]);
  const [selectedTemas, setSelectedTemas] = useState<string[]>([]);
  const [selectedSubtemas, setSelectedSubtemas] = useState<string[]>([]);
  const [filterOrigem, setFilterOrigem] = useState<'todos' | 'originais' | 'antigas'>('todos');

  // Dados do App & Paginação
  const [questoes, setQuestoes] = useState<any[]>([]);
  const [respostas, setRespostas] = useState<Record<number, number>>({});
  const [explicas, setExplicas] = useState<Record<number, boolean>>({});
  const [stats, setStats] = useState({ totalSemana: 0, taxa: 0 });
  
  // PAGINAÇÃO
  const [page, setPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(25); // Padrão 25
  const [hasMore, setHasMore] = useState(false);

  // Admin Geral
  const [abaAdmin, setAbaAdmin] = useState<'questoes' | 'usuarios' | 'reportes' | 'padronizacao' | null>(null);
  const [listaUsuarios, setListaUsuarios] = useState<any[]>([]);
  const [listaReportes, setListaReportes] = useState<any[]>([]); 
  const [listaTemasAdmin, setListaTemasAdmin] = useState<any[]>([]); // NOVA LISTA
  const [datasTemp, setDatasTemp] = useState<Record<string, string>>({});

  // Form Admin (Cadastro Novo)
  const [fEnun, setFEnun] = useState('');
  const [fOps, setFOps] = useState(['', '', '', '']);
  const [fCorr, setFCorr] = useState(0);
  const [fDisc, setFDisc] = useState('');
  const [fTema, setFTema] = useState('');
  const [fSubtema, setFSubtema] = useState('');
  const [fJust, setFJust] = useState('');
  const [fImg, setFImg] = useState(''); // Imagem do Enunciado
  const [fImgJust, setFImgJust] = useState(''); // Imagem da Justificativa
  const [fOrigemCadastro, setFOrigemCadastro] = useState('med53'); 

  // --- ADMIN IN-LINE (Edição Rápida) ---
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const startEditing = (q: any) => {
    setEditingId(q.id);
    setEditForm({ ...q }); 
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleInlineDelete = async (id: number) => {
    if (!confirm("Tem certeza absoluta que deseja APAGAR esta questão?")) return;
    
    const { error } = await supabase.from('questoes').delete().eq('id', id);
    if (error) {
      alert("Erro ao apagar: " + error.message);
    } else {
      setQuestoes(prev => prev.filter(q => q.id !== id));
      alert("Questão apagada!");
    }
  };

  const handleInlineSave = async () => {
    if (!editForm.enunciado || !editForm.disciplina) return alert("Preencha os campos obrigatórios.");
    
    setLoading(true);
    const { error } = await supabase.from('questoes').update({
      enunciado: editForm.enunciado,
      opcoes: editForm.opcoes,
      resposta_correta: editForm.resposta_correta,
      justificativa: editForm.justificativa,
      disciplina: editForm.disciplina,
      tema: editForm.tema,
      subtema: editForm.subtema,
      imagem_url: editForm.imagem_url,
      imagem_justificativa: editForm.imagem_justificativa 
    }).eq('id', editingId);

    if (error) {
      alert("Erro ao salvar: " + error.message);
    } else {
      setQuestoes(prev => prev.map(q => q.id === editingId ? editForm : q));
      setEditingId(null);
      setEditForm({});
      alert("Questão atualizada com sucesso!");
    }
    setLoading(false);
  };

  // --- FUNÇÃO DE REPORTAR ERRO ---
  const handleReportIssue = async (qId: number, motivo: string) => {
    if(!user) return;
    try {
        await supabase.from('reportes').insert([{
            user_id: user.id,
            questao_id: qId,
            motivo: motivo
        }]);
        alert("Obrigado! Vamos analisar o erro.");
        setReportingId(null); // Fecha o menu
    } catch (e) {
        alert("Erro ao enviar reporte. Verifique se o SQL da tabela 'reportes' foi criado.");
    }
  };

  // --- FUNÇÕES DE ADMIN: GERENCIAR REPORTES ---
  async function carregarReportes() {
      const { data, error } = await supabase
        .from('reportes')
        .select('*, questoes(disciplina, tema)')
        .order('created_at', { ascending: false });
      
      if (error) console.error("Erro reportes:", error);
      setListaReportes(data || []);
  }

  async function resolverReporte(qId: number, reporteId: number) {
      setLoading(true);
      const { data: questao } = await supabase.from('questoes').select('*').eq('id', qId).single();
      
      if (questao) {
          setQuestoes([questao]);
          setViewMode('feed');
          setAbaAdmin(null);
          startEditing(questao);
      } else {
          alert("Questão não encontrada (pode ter sido apagada).");
      }
      setLoading(false);
  }

  async function apagarReporte(id: number) {
      if(!confirm("Apagar este reporte da lista?")) return;
      await supabase.from('reportes').delete().eq('id', id);
      carregarReportes(); // Recarrega a lista
  }

  // --- FUNÇÕES DE ADMIN: PADRONIZAÇÃO ---
  async function carregarPadronizacao() {
      const { data } = await supabase.from('questoes').select('disciplina, tema').range(0, 9999);
      if(!data) return;

      const mapa: Record<string, { disciplina: string, tema: string, count: number }> = {};
      
      data.forEach(item => {
          if(!item.tema) return;
          const key = `${item.disciplina}-${item.tema}`;
          if(!mapa[key]) {
              mapa[key] = { disciplina: item.disciplina, tema: item.tema, count: 0 };
          }
          mapa[key].count++;
      });

      const listaOrdenada = Object.values(mapa).sort((a,b) => a.disciplina.localeCompare(b.disciplina) || a.tema.localeCompare(b.tema));
      setListaTemasAdmin(listaOrdenada);
  }

  // --- ATUALIZADO: EDITA DISCIPLINA E TEMA AO MESMO TEMPO ---
  async function editarTopico(discAntiga: string, temaAntigo: string, count: number) {
      // 1. Pergunta a Nova Disciplina
      const novaDisc = prompt(`ATENÇÃO: Editando ${count} questões.\n\nQual a NOVA DISCIPLINA para "${temaAntigo}"?`, discAntiga);
      if(!novaDisc) return; // Cancelou

      // 2. Pergunta o Novo Tema
      const novoTema = prompt(`Disciplina definida: ${novaDisc}\n\nQual o NOVO TEMA?`, temaAntigo);
      if(!novoTema) return; // Cancelou

      if (novaDisc === discAntiga && novoTema === temaAntigo) return; // Não mudou nada

      if(!confirm(`Mover ${count} questões\nDE: ${discAntiga} > ${temaAntigo}\nPARA: ${novaDisc} > ${novoTema}\n\nConfirmar?`)) return;

      setLoading(true);
      const { error } = await supabase.from('questoes')
          .update({ disciplina: novaDisc, tema: novoTema })
          .eq('disciplina', discAntiga)
          .eq('tema', temaAntigo);

      if(error) alert("Erro ao atualizar: " + error.message);
      else {
          alert("Sucesso! Tópicos atualizados.");
          await carregarPadronizacao();
          await buscarDadosEstruturais();
      }
      setLoading(false);
  }

  // --- HEARTBEAT ANTI-PREJUÍZO 💓 ---
  useEffect(() => {
    if (!user) return; // Só roda se tiver usuário logado

    const checkSessaoAtiva = async () => {
        const session = await supabase.auth.getSession();
        const tokenAtual = session.data.session?.access_token;
        if (!tokenAtual) return;

        const { data } = await supabase.from('perfis').select('last_session_id').eq('id', user.id).single();

        if (data?.last_session_id && data.last_session_id !== tokenAtual) {
            console.warn("Sessão derrubada por novo login.");
            setSessaoInvalida(true); // Ativa a tela vermelha
            supabase.auth.signOut(); // Desloga do Supabase
        }
    };

    const intervalo = setInterval(checkSessaoAtiva, 5000);
    return () => clearInterval(intervalo);
  }, [user]);

  // --- INICIALIZAÇÃO BLINDADA COM TIMEOUT ---
  useEffect(() => {
    let mounted = true;

    // VÁLVULA DE SEGURANÇA: Se em 8 segundos não carregar, libera a tela de login.
    const safetyTimer = setTimeout(() => {
        if (mounted && loading) {
            console.log("Timeout de segurança ativado.");
            setLoading(false);
        }
    }, 8000);

    const init = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user && mounted) {
                try { await registrarSessaoUnica(session.user.id, session.access_token); } catch {}
                await inicializar(session.user, session.access_token);
            } else if (mounted) {
                resetEstadoTotal();
            }
        } catch (error) {
            console.error("Erro no init:", error);
            if (mounted) resetEstadoTotal();
        }
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
             registrarSessaoUnica(session.user.id, session.access_token).then(() => {
                 inicializar(session.user, session.access_token);
             });
        } else if (event === 'SIGNED_OUT') {
            resetEstadoTotal();
        }
    });

    return () => { mounted = false; clearTimeout(safetyTimer); subscription.unsubscribe(); };
  }, []);

  const contagemPrevia = useMemo(() => {
    let total = 0;
    selectedDiscs.forEach(d => {
      if (!filtroMapa[d]) return;
      Object.keys(filtroMapa[d].temas).forEach(t => {
        if (selectedTemas.includes(t)) {
          const dadosTema = filtroMapa[d].temas[t];
          const listaSubtemas = Object.keys(dadosTema.subtemas);
          if (listaSubtemas.length > 0) {
            listaSubtemas.forEach(sub => {
              if (selectedSubtemas.includes(sub)) {
                total += dadosTema.subtemas[sub];
              }
            });
          } else {
            total += dadosTema.total;
          }
        }
      });
    });
    return total;
  }, [selectedDiscs, selectedTemas, selectedSubtemas, filtroMapa]);

  const resetEstadoTotal = () => {
    setUser(null); setIsAdmin(false); setAssinatura(null);
    setQuestoes([]); setSelectedDiscs([]); setSelectedTemas([]); setSelectedSubtemas([]);
    setRespostas({}); setExplicas({}); setLoading(false); setViewMode('home');
  };

  async function registrarSessaoUnica(uid: string, token: string) {
    try {
        await supabase.from('perfis').update({ last_session_id: token }).eq('id', uid);
    } catch (e) { console.error("Erro ao registrar sessão:", e); }
  }

  async function inicializar(u: any, token: string) {
    try {
      const { data: perfil } = await supabase.from('perfis').select('*').eq('id', u.id).maybeSingle();
      
      if (!perfil) console.warn("Perfil não encontrado no init.");

      if (perfil?.last_session_id && perfil.last_session_id !== token) {
        setSessaoInvalida(true); 
        await supabase.auth.signOut(); 
        return;
      }

      const { data: ass } = await supabase.from('assinaturas').select('*').eq('user_id', u.id).maybeSingle();
      
      setUser(u); 
      setIsAdmin(perfil?.is_admin || false);
      setStreak(perfil?.streak_atual || 0);

      const isValida = ass?.status === 'ativo' && new Date(ass.data_expiracao) > new Date();
      setAssinatura(isValida ? ass : { status: 'expirado' });
      
      await buscarDadosEstruturais();
      await carregarStats(u.id);
      if (perfil?.is_admin) {
        carregarListaUsuarios();
      }
    } catch (e) { 
        console.error(e);
        handleLogout(true); 
    } finally { setLoading(false); }
  }

  async function atualizarStreak(uid: string) {
    const hoje = new Date().toISOString().split('T')[0];
    const { data: perfil } = await supabase.from('perfis').select('streak_atual, ultima_atividade').eq('id', uid).single();
    if (perfil) {
        if (perfil.ultima_atividade !== hoje) {
            const ontem = new Date();
            ontem.setDate(ontem.getDate() - 1);
            const dataOntem = ontem.toISOString().split('T')[0];
            let novoStreak = 1;
            if (perfil.ultima_atividade === dataOntem) novoStreak = (perfil.streak_atual || 0) + 1;
            await supabase.from('perfis').update({ streak_atual: novoStreak, ultima_atividade: hoje }).eq('id', uid);
            setStreak(novoStreak);
        }
    }
  }

  async function carregarListaUsuarios() {
    const { data: perfis } = await supabase.from('perfis').select('*');
    const { data: assins } = await supabase.from('assinaturas').select('*');
    setListaUsuarios(perfis?.map(p => ({ ...p, assinatura: assins?.find(a => a.user_id === p.id) })) || []);
  }

  async function definirValidadeManual(userId: string) {
    const dataIso = new Date(datasTemp[userId]).toISOString();
    await supabase.from('assinaturas').upsert({ user_id: userId, status: 'ativo', data_expiracao: dataIso }, { onConflict: 'user_id' });
    alert("Liberado!"); carregarListaUsuarios();
  }

  async function carregarStats(uid: string) {
    const { data } = await supabase.from('historico_questoes').select('acertou').eq('user_id', uid);
    if (data) setStats({ totalSemana: data.length, taxa: data.length > 0 ? Math.round((data.filter(h => h.acertou).length / data.length) * 100) : 0 });
  }

  async function buscarDadosEstruturais() {
    // TEM QUE TER O .range(0, 9999) AQUI
    const { data } = await supabase
        .from('questoes')
        .select('disciplina, tema, subtema, origem')
        .range(0, 9999); 
    setAllData(data || []);
  }

  useEffect(() => {
    const mapa: any = {};
    allData.forEach(q => {
      if (!q.disciplina) return;
      if (filterOrigem === 'originais' && q.origem !== 'med53') return;
      if (filterOrigem === 'antigas' && q.origem === 'med53') return;
      
      if (!mapa[q.disciplina]) mapa[q.disciplina] = { total: 0, temas: {} };
      mapa[q.disciplina].total++; 

      if (q.tema) {
        if (!mapa[q.disciplina].temas[q.tema]) mapa[q.disciplina].temas[q.tema] = { total: 0, subtemas: {} };
        mapa[q.disciplina].temas[q.tema].total++; 
        if (q.subtema) {
            if (!mapa[q.disciplina].temas[q.tema].subtemas[q.subtema]) mapa[q.disciplina].temas[q.tema].subtemas[q.subtema] = 0;
            mapa[q.disciplina].temas[q.tema].subtemas[q.subtema]++;
        }
      }
    });
    setFiltroMapa(mapa);
  }, [allData, filterOrigem]);

  useEffect(() => {
    if (selectedDiscs.length === 0) return;
    let novosTemas: string[] = [];
    let novosSubtemas: string[] = [];
    selectedDiscs.forEach(d => {
      if (filtroMapa[d]) {
        const temasDaDisc = Object.keys(filtroMapa[d].temas);
        novosTemas = [...novosTemas, ...temasDaDisc];
        temasDaDisc.forEach(t => {
             const subs = Object.keys(filtroMapa[d].temas[t].subtemas);
             novosSubtemas = [...novosSubtemas, ...subs];
        });
      }
    });
  }, [filtroMapa]); 

  // --- BUSCA COM PAGINAÇÃO E EMBARALHAMENTO ---
  async function buscarQuestoes(novaPagina = 0) {
    if (!user) return;
    setLoading(true);
    setPage(novaPagina);

    let q = supabase.from('questoes').select('id, enunciado, opcoes, resposta_correta, disciplina, tema, subtema, imagem_url, justificativa, imagem_justificativa, origem', { count: 'estimated' });
    
    // Filtros
    if (selectedDiscs.length > 0) q = q.in('disciplina', selectedDiscs);
    if (selectedTemas.length > 0) q = q.in('tema', selectedTemas);
    if (filterOrigem === 'originais') q = q.eq('origem', 'med53');
    if (filterOrigem === 'antigas') q = q.neq('origem', 'med53');

    // Paginação
    const inicio = novaPagina * itemsPerPage;
    const fim = inicio + itemsPerPage - 1;
    q = q.range(inicio, fim);

    const { data, count, error } = await q;
    
    if (error) {
      console.error('Erro:', error);
      setQuestoes([]);
    } else {
      // 1. Filtragem de subtemas no cliente
      const filtradas = (data || []).filter(item => {
          if (item.subtema) {
              return selectedSubtemas.some(selected => 
                  selected.trim().toLowerCase() === item.subtema.trim().toLowerCase()
              );
          }
          return true;
      });

      // 2. APLICAR O EMBARALHAMENTO AQUI
      const finais = isAdmin ? filtradas : embaralharQuestoes(filtradas);

      setQuestoes(finais);
      setHasMore(count ? (inicio + itemsPerPage) < count : false);
    }
    setLoading(false);
  }

  // --- FUNÇÕES DE SELEÇÃO DE FILTROS ---
  const handleSelectDisc = (disc: string, checked: boolean) => {
    const newDiscs = checked ? [...selectedDiscs, disc] : selectedDiscs.filter(d => d !== disc);
    setSelectedDiscs(newDiscs);

    if (filtroMapa[disc]) {
        const temasDaDisc = Object.keys(filtroMapa[disc].temas);
        let novosTemas = [...selectedTemas];
        let novosSubtemas = [...selectedSubtemas];

        temasDaDisc.forEach(t => {
            if (checked) {
                if (!novosTemas.includes(t)) novosTemas.push(t);
                const subs = Object.keys(filtroMapa[disc].temas[t].subtemas);
                subs.forEach(s => { if (!novosSubtemas.includes(s)) novosSubtemas.push(s); });
            } else {
                novosTemas = novosTemas.filter(item => item !== t);
                const subs = Object.keys(filtroMapa[disc].temas[t].subtemas);
                novosSubtemas = novosSubtemas.filter(item => !subs.includes(item));
            }
        });
        setSelectedTemas(novosTemas);
        setSelectedSubtemas(novosSubtemas);
    }
  };

  const handleSelectTema = (disc: string, tema: string, checked: boolean) => {
    if (checked && !selectedDiscs.includes(disc)) setSelectedDiscs([...selectedDiscs, disc]);
    
    const newTemas = checked ? [...selectedTemas, tema] : selectedTemas.filter(t => t !== tema);
    setSelectedTemas(newTemas);

    if (filtroMapa[disc]?.temas[tema]) {
        const subs = Object.keys(filtroMapa[disc].temas[tema].subtemas);
        let novosSubs = [...selectedSubtemas];
        subs.forEach(s => {
            if (checked) { if (!novosSubs.includes(s)) novosSubs.push(s); }
            else { novosSubs = novosSubs.filter(x => x !== s); }
        });
        setSelectedSubtemas(novosSubs);
    }
  };

  const handleSelectSubtema = (disc: string, tema: string, sub: string, checked: boolean) => {
      if (checked) {
          if (!selectedDiscs.includes(disc)) setSelectedDiscs([...selectedDiscs, disc]);
          if (!selectedTemas.includes(tema)) setSelectedTemas([...selectedTemas, tema]);
          setSelectedSubtemas([...selectedSubtemas, sub]);
      } else {
          setSelectedSubtemas(selectedSubtemas.filter(s => s !== sub));
      }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      if (isForgot) {
        await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        alert("E-mail enviado!"); setIsForgot(false);
      } else if (isSignUp) {
        if (email !== confirmEmail) throw new Error("Os e-mails não conferem.");
        if (password !== confirmPassword) throw new Error("As senhas não conferem.");
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user && !data.session) { alert("Cadastro feito! Faça login."); setIsSignUp(false); }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // FORÇA A ENTRADA: Registra a sessão imediatamente ao logar com sucesso
        if (data.user) {
            await registrarSessaoUnica(data.user.id, data.session!.access_token);
        }
      }
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleLogout = async (forced = false) => {
    resetEstadoTotal();
    localStorage.clear(); 
    sessionStorage.clear();
    
    if (!forced) setLoading(true);
    try { await supabase.auth.signOut(); } catch {} 
    finally { window.location.href = "/"; }
  };

  if (sessaoInvalida) return <div className="min-h-screen bg-rose-50 flex items-center justify-center p-6"><div className="bg-white p-8 rounded-2xl shadow-xl text-center animate-in zoom-in-95"><AlertTriangle className="mx-auto text-rose-600 mb-4" size={32} /><h2 className="font-black text-slate-900 mb-2">Conexão Interrompida</h2><p className="text-slate-600 text-sm mb-6">Acesso detectado em outro dispositivo.</p><button onClick={() => window.location.reload()} className="bg-rose-600 text-white py-3 px-6 rounded-xl font-bold uppercase text-xs hover:bg-rose-700 transition-colors">Reconectar</button></div></div>;

  if (loading && !user) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FBFBFB] gap-4">
        <Loader2 className="animate-spin text-[#00a884]" size={24} />
        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Carregando MED53...</span>
        {/* AVISO DE CARREGAMENTO PARA O USUÁRIO ENTENDER A DEMORA */}
        <div className="flex flex-col items-center gap-2 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-1000">
           <Server size={16} className="text-slate-300 animate-pulse"/>
           <p className="text-[10px] text-slate-400 text-center max-w-[250px]">
             Demorando? O servidor pode estar "acordando".<br/>Isso leva cerca de 10-20 segundos.
           </p>
        </div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-10 rounded-3xl border border-slate-200 w-full max-w-xs shadow-2xl animate-in zoom-in-95">
        <h1 className="text-3xl font-black text-slate-900 mb-2 text-center tracking-tighter italic">MED<span className="text-[#00a884] not-italic">53</span></h1>
        <p className="text-center text-slate-500 text-[10px] uppercase font-black mb-6 tracking-widest">{isForgot ? 'Recuperar Acesso' : (isSignUp ? 'Criar Nova Conta' : 'Acesso Acadêmico')}</p>
        
        {/* AVISO DE SEGURANÇA (NOVO) */}
        <div className="mb-6 p-3 bg-amber-50 border border-amber-100 rounded-xl flex gap-3 items-start">
            <ShieldAlert size={16} className="text-amber-500 shrink-0 mt-0.5"/>
            <p className="text-[10px] text-amber-800 font-bold leading-tight">Conta pessoal. Acessos simultâneos bloqueiam a conexão anterior.</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="relative"><Mail className="absolute left-4 top-3.5 text-slate-400" size={16} /><input type="email" placeholder="E-mail" className="w-full pl-12 p-4 bg-slate-50 border-none rounded-2xl text-xs outline-none focus:ring-2 focus:ring-[#00a884]/20 text-slate-800 font-bold" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          {isSignUp && <div className="relative animate-in slide-in-from-top-2"><Mail className="absolute left-4 top-3.5 text-slate-400" size={16} /><input type="email" placeholder="Confirme E-mail" className="w-full pl-12 p-4 bg-slate-50 border-none rounded-2xl text-xs outline-none focus:ring-2 focus:ring-[#00a884]/20 text-slate-800 font-bold" value={confirmEmail} onChange={e => setConfirmEmail(e.target.value)} required /></div>}
          {!isForgot && <div className="relative"><Lock className="absolute left-4 top-3.5 text-slate-400" size={16} /><input type="password" placeholder="Senha" className="w-full pl-12 p-4 bg-slate-50 border-none rounded-2xl text-xs outline-none focus:ring-2 focus:ring-[#00a884]/20 text-slate-800 font-bold" value={password} onChange={e => setPassword(e.target.value)} required /></div>}
          {isSignUp && <div className="relative animate-in slide-in-from-top-2"><Lock className="absolute left-4 top-3.5 text-slate-400" size={16} /><input type="password" placeholder="Confirme Senha" className="w-full pl-12 p-4 bg-slate-50 border-none rounded-2xl text-xs outline-none focus:ring-2 focus:ring-[#00a884]/20 text-slate-800 font-bold" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required /></div>}
          <button type="submit" className="w-full bg-[#00a884] text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-[#00a884]/20 transition-transform active:scale-95">{isForgot ? 'Enviar Link' : (isSignUp ? 'Cadastrar' : 'Entrar')}</button>
        </form>
        <div className="mt-6 space-y-2 text-center">
          {!isForgot && (<><button onClick={() => setIsForgot(true)} className="block w-full text-[10px] font-bold text-slate-400 hover:text-[#00a884]">Esqueci minha senha</button><button onClick={() => {setIsSignUp(!isSignUp); setConfirmEmail(''); setConfirmPassword('');}} className="block w-full text-[10px] font-black text-slate-600 uppercase tracking-tighter hover:text-[#00a884]">{isSignUp ? 'Já tem conta? Faça Login' : 'Não tem conta? Cadastre-se'}</button></>)}
          {isForgot && (<button onClick={() => setIsForgot(false)} className="text-[10px] font-black text-slate-600 uppercase tracking-tighter hover:text-[#00a884] flex items-center justify-center gap-1 mx-auto"><ArrowLeft size={12}/> Voltar</button>)}
        </div>
      </div>
    </div>
  );

  const isAssinante = assinatura?.status === 'ativo' && new Date(assinatura.data_expiracao) > new Date();

  return (
    <div className="h-screen w-screen bg-[#FBFBFB] text-slate-800 font-sans text-[13px] flex flex-col overflow-hidden">
      <nav className="shrink-0 bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          {viewMode === 'feed' && (
             <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                 {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
             </button>
          )}

          {viewMode === 'feed' && <button onClick={() => { setViewMode('home'); setPage(0); }} className="p-2 mr-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><ArrowLeft size={16}/></button>}
          <h1 onClick={() => setAbaAdmin(null)} className="text-lg font-black text-slate-900 tracking-tighter cursor-pointer">MED<span className="text-[#00a884]">53</span></h1>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          
          {/* FOGUINHO (STREAK) */}
          <div className="flex items-center gap-1 bg-orange-50 text-orange-600 px-3 py-1 rounded-full border border-orange-100" title="Dias seguidos de estudo">
              <Flame size={14} fill="currentColor" className={streak > 0 ? "animate-pulse" : "opacity-50"} />
              <span className="font-black text-[10px]">{streak}</span>
          </div>

          {isAdmin && (<div className="hidden sm:flex gap-2">
              <button onClick={() => setAbaAdmin(abaAdmin === 'questoes' ? null : 'questoes')} className={`text-[9px] font-black border px-3 py-1 rounded-md uppercase transition-all ${abaAdmin === 'questoes' ? 'bg-[#00a884] text-white' : 'text-slate-600'}`}>Questões</button>
              <button onClick={() => setAbaAdmin(abaAdmin === 'usuarios' ? null : 'usuarios')} className={`text-[9px] font-black border px-3 py-1 rounded-md uppercase transition-all ${abaAdmin === 'usuarios' ? 'bg-[#00a884] text-white' : 'text-slate-600'}`}>Alunos</button>
              <button onClick={() => { setAbaAdmin(abaAdmin === 'reportes' ? null : 'reportes'); carregarReportes(); }} className={`text-[9px] font-black border px-3 py-1 rounded-md uppercase transition-all flex items-center gap-1 ${abaAdmin === 'reportes' ? 'bg-rose-600 text-white border-rose-600' : 'text-slate-600 border-slate-200'}`}> <AlertOctagon size={10}/> Reportes</button>
              <button onClick={() => { setAbaAdmin(abaAdmin === 'padronizacao' ? null : 'padronizacao'); carregarPadronizacao(); }} className={`text-[9px] font-black border px-3 py-1 rounded-md uppercase transition-all flex items-center gap-1 ${abaAdmin === 'padronizacao' ? 'bg-blue-600 text-white border-blue-600' : 'text-slate-600 border-slate-200'}`}> <Tags size={10}/> Padronização</button>
          </div>)}
          <button onClick={() => handleLogout(false)} className="text-slate-600 hover:text-rose-600 transition-colors flex items-center gap-1 font-black uppercase text-[10px]">Sair <LogOut size={16}/></button>
        </div>
      </nav>

      {/* Container Principal */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {viewMode === 'feed' && !abaAdmin && (
          <>
            {mobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-black/40 z-30 md:hidden backdrop-blur-sm transition-opacity"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            <aside className={`fixed md:relative inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 transition-transform duration-300 md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-6 overflow-y-auto h-full">
                <div className="flex items-center justify-between mb-8 border-b pb-2">
                    <div className="flex items-center gap-2 text-slate-700 uppercase font-black text-[10px] tracking-[0.2em]"><Filter size={14} className="text-[#00a884]"/> Filtros Ativos</div>
                    <button onClick={() => setMobileMenuOpen(false)} className="md:hidden text-slate-400"><X size={16}/></button>
                </div>
                <div className="space-y-4">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Origem</span>
                    <div className="text-xs font-black text-slate-800 flex items-center gap-2">
                        {filterOrigem === 'todos' ? 'Todas as Questões' : (filterOrigem === 'originais' ? 'Originais MED53' : 'Provas Antigas')}
                    </div>
                    </div>
                    <div className="space-y-1">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Disciplinas</span>
                    {selectedDiscs.map(d => <div key={d} className="flex items-center gap-2 text-xs font-bold text-slate-700"><CheckCircle2 size={12} className="text-[#00a884]"/> {d}</div>)}
                    </div>
                    <button onClick={() => setViewMode('home')} className="w-full border border-slate-300 text-slate-600 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-slate-50 mt-4">Alterar Filtros</button>
                </div>
                </div>
            </aside>
          </>
        )}

        <main className={`flex-1 bg-[#FBFBFB] ${viewMode === 'home' ? 'h-full relative' : 'overflow-y-auto'}`}>
          
          {viewMode === 'home' && !abaAdmin && (
            <div className="h-full flex flex-col animate-in fade-in">
              <div className="shrink-0 bg-white border-b border-slate-200 p-6 flex flex-col md:flex-row justify-between items-center gap-4 z-30 shadow-sm">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Filtros Inteligentes</h2>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-medium overflow-x-auto whitespace-nowrap">
                    <Layout size={14}/>
                    <span>Início</span>
                    {activeDisc && <><ChevronRight size={12}/> <span className="text-slate-800 font-bold">{activeDisc}</span></>}
                    {activeTema && <><ChevronRight size={12}/> <span className="text-slate-800 font-bold">{activeTema}</span></>}
                  </div>
                </div>
                
                <div className="bg-slate-100 p-1 rounded-lg flex shrink-0">
                      <button onClick={() => setFilterOrigem('todos')} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${filterOrigem === 'todos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Todas</button>
                      <button onClick={() => setFilterOrigem('originais')} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${filterOrigem === 'originais' ? 'bg-[#00a884] text-white shadow-sm' : 'text-slate-500'}`}>Originais</button>
                      <button onClick={() => setFilterOrigem('antigas')} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${filterOrigem === 'antigas' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500'}`}>Antigas</button>
                </div>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative bg-white pb-[70px]">
                <div className="w-full md:w-1/3 border-r border-slate-200 bg-white flex flex-col overflow-hidden h-full">
                    <div className="shrink-0 p-3 bg-slate-50 border-b font-black text-[10px] text-slate-500 uppercase tracking-widest flex justify-between">
                        <span>1. Disciplinas</span>
                        <span>{Object.keys(filtroMapa).length} Opções</span>
                    </div>
                    <div className="overflow-y-auto flex-1 p-2 space-y-1">
                        {Object.keys(filtroMapa).length > 0 ? Object.keys(filtroMapa).sort().map(d => (
                            <div key={d} 
                                onClick={() => { setActiveDisc(d); setActiveTema(null); }}
                                className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border ${activeDisc === d ? 'bg-blue-50 border-blue-200' : 'bg-white border-transparent hover:bg-slate-50'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div onClick={(e) => { e.stopPropagation(); handleSelectDisc(d, !selectedDiscs.includes(d)); }} 
                                         className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${selectedDiscs.includes(d) ? 'bg-[#00a884] border-[#00a884]' : 'border-slate-300 hover:border-[#00a884]'}`}>
                                         {selectedDiscs.includes(d) && <Check size={12} className="text-white"/>}
                                    </div>
                                    <span className={`text-xs font-bold ${activeDisc === d ? 'text-blue-700' : 'text-slate-700'}`}>{d}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black text-slate-300 bg-slate-50 px-1.5 py-0.5 rounded">{filtroMapa[d].total}</span>
                                    <ChevronRight size={14} className={activeDisc === d ? 'text-blue-500' : 'text-slate-300'}/>
                                </div>
                            </div>
                        )) : <div className="p-4 text-center text-slate-400 text-xs italic">Carregando...</div>}
                    </div>
                </div>

                <div className={`w-full md:w-1/3 border-r border-slate-200 bg-slate-50/50 flex flex-col overflow-hidden h-full transition-all ${!activeDisc ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                    <div className="shrink-0 p-3 bg-slate-100 border-b font-black text-[10px] text-slate-500 uppercase tracking-widest flex justify-between">
                        <span>2. Temas {activeDisc ? `de ${activeDisc}` : ''}</span>
                        {activeDisc && filtroMapa[activeDisc] && <span>{Object.keys(filtroMapa[activeDisc].temas).length} Opções</span>}
                    </div>
                    <div className="overflow-y-auto flex-1 p-2 space-y-1">
                        {activeDisc && filtroMapa[activeDisc] ? Object.keys(filtroMapa[activeDisc].temas).sort().map(t => (
                            <div key={t} 
                                onClick={() => setActiveTema(t)}
                                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border ${activeTema === t ? 'bg-white shadow-sm border-blue-200' : 'border-transparent hover:bg-white/60'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div onClick={(e) => { e.stopPropagation(); handleSelectTema(activeDisc, t, !selectedTemas.includes(t)); }} 
                                         className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${selectedTemas.includes(t) ? 'bg-[#00a884] border-[#00a884]' : 'border-slate-300 hover:border-[#00a884]'}`}>
                                         {selectedTemas.includes(t) && <Check size={10} className="text-white"/>}
                                    </div>
                                    <span className={`text-xs font-medium ${activeTema === t ? 'text-blue-700 font-bold' : 'text-slate-600'}`}>{t}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-bold text-slate-400">{filtroMapa[activeDisc].temas[t].total}</span>
                                    {Object.keys(filtroMapa[activeDisc].temas[t].subtemas).length > 0 && <ChevronRight size={14} className="text-slate-300"/>}
                                </div>
                            </div>
                        )) : <div className="h-full flex flex-col items-center justify-center text-slate-300 text-xs font-medium"><FolderOpen size={32} className="mb-2 opacity-20"/> Selecione uma disciplina</div>}
                    </div>
                </div>

                <div className={`w-full md:w-1/3 bg-[#FBFBFB] flex flex-col overflow-hidden h-full transition-all ${!activeTema ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="shrink-0 p-3 bg-slate-100 border-b font-black text-[10px] text-slate-500 uppercase tracking-widest">
                        3. Subtemas
                    </div>
                    <div className="overflow-y-auto flex-1 p-2 space-y-1">
                         {activeDisc && activeTema && filtroMapa[activeDisc]?.temas[activeTema] ? (
                            Object.keys(filtroMapa[activeDisc].temas[activeTema].subtemas).length > 0 ? 
                            Object.keys(filtroMapa[activeDisc].temas[activeTema].subtemas).sort().map(s => (
                                <label key={s} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white cursor-pointer transition-colors">
                                    <div onClick={(e) => { e.stopPropagation(); handleSelectSubtema(activeDisc, activeTema, s, !selectedSubtemas.includes(s)); }} 
                                         className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${selectedSubtemas.includes(s) ? 'bg-[#00a884] border-[#00a884]' : 'border-slate-300 hover:border-[#00a884]'}`}>
                                         {selectedSubtemas.includes(s) && <Check size={10} className="text-white"/>}
                                    </div>
                                    <span className={`text-xs ${selectedSubtemas.includes(s) ? 'text-slate-800 font-bold' : 'text-slate-500'}`}>{s}</span>
                                    <span className="ml-auto text-[9px] bg-slate-100 text-slate-400 px-1.5 rounded">{filtroMapa[activeDisc].temas[activeTema].subtemas[s]}</span>
                                </label>
                            )) : <div className="p-8 text-center text-slate-400 text-xs italic">Este tema não possui subdivisões.</div>
                         ) : <div className="h-full flex flex-col items-center justify-center text-slate-300 text-xs font-medium"><Folder size={32} className="mb-2 opacity-20"/> Selecione um tema</div>}
                    </div>
                </div>

              </div>

              <div className="absolute bottom-0 left-0 w-full h-[70px] bg-white border-t border-slate-200 px-6 flex justify-between items-center shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50">
                <div className="flex items-center gap-6">
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-900 animate-in fade-in leading-none">{contagemPrevia}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide leading-none">Questões</span>
                    </div>
                    <div className="h-8 w-px bg-slate-200 hidden md:block"></div>
                    <div className="hidden md:block text-[11px] font-medium text-slate-500">
                        {selectedDiscs.length === 0 ? <span className="text-slate-400 italic">Nenhum filtro</span> : <span>{selectedDiscs.length} Disciplinas • {selectedTemas.length} Temas</span>}
                    </div>
                </div>
                
                <button 
                    onClick={() => { if(selectedDiscs.length > 0) { buscarQuestoes(0); setViewMode('feed'); } else { alert("Selecione pelo menos uma disciplina."); }}}
                    className={`h-10 px-6 rounded-full font-black uppercase text-[10px] tracking-wide transition-all flex items-center gap-2 ${selectedDiscs.length > 0 ? 'bg-[#00a884] text-white hover:scale-105 shadow-lg shadow-[#00a884]/30' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                >
                    Gerar Caderno <Play size={12} fill="currentColor"/>
                </button>
              </div>

            </div>
          )}

          {viewMode === 'feed' && !abaAdmin && (
            <div className="max-w-3xl mx-auto p-4 md:p-12 animate-in slide-in-from-right-4">
              {!isAssinante && !isAdmin ? (
                <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-2xl text-center mt-8"><div className="flex justify-center mb-6"><div className="bg-[#00a884]/10 p-4 rounded-full"><CreditCard className="text-[#00a884]" size={40} /></div></div><h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tighter">Escolha seu Plano</h2><p className="text-slate-600 mb-12 leading-relaxed font-bold text-sm max-w-xl mx-auto">Libere acesso. Aceitamos Cartão de Crédito (até 12x), PIX e Boleto via Mercado Pago.</p><div className="grid md:grid-cols-3 gap-6"><div className="p-8 border-2 border-slate-100 rounded-3xl text-left bg-white hover:border-[#00a884]/30 hover:shadow-xl transition-all"><h3 className="font-black text-slate-800 text-lg">Mensal</h3><div className="mt-4 mb-6"><span className="text-sm font-bold text-slate-400">R$</span><span className="text-3xl font-black text-slate-900">24,90</span><span className="text-xs font-bold text-slate-400">/mês</span></div><button onClick={() => window.open('https://mpago.li/2yjdqU2', '_blank')} className="w-full bg-slate-900 text-white py-3 rounded-xl font-black uppercase text-[10px] hover:bg-[#00a884] transition-colors">Assinar</button></div><div className="p-8 border-2 border-slate-100 rounded-3xl text-left bg-white hover:border-[#00a884]/30 hover:shadow-xl transition-all relative"><h3 className="font-black text-slate-800 text-lg">Semestral</h3><div className="mt-4 mb-2"><span className="text-sm font-bold text-slate-400">R$</span><span className="text-3xl font-black text-slate-900">119</span></div><p className="text-[11px] font-black text-[#00a884] mb-6">👉 R$ 19,80/mês</p><button onClick={() => window.open('LINK_SEMESTRAL', '_blank')} className="w-full bg-slate-900 text-white py-3 rounded-xl font-black uppercase text-[10px] hover:bg-[#00a884] transition-colors">Indisponível!</button></div><div className="p-8 border-2 border-[#00a884] rounded-3xl text-left bg-[#00a884]/5 relative shadow-lg shadow-[#00a884]/10"><div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#00a884] text-white text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest shadow-md">Recomendado</div><h3 className="font-black text-slate-800 text-lg">Anual</h3><div className="mt-4 mb-2"><span className="text-sm font-bold text-slate-400">R$</span><span className="text-3xl font-black text-slate-900">199</span></div><p className="text-[11px] font-black text-[#00a884] mb-6">👉 R$ 16,60/mês</p><button onClick={() => window.open('LINK_ANUAL', '_blank')} className="w-full bg-[#00a884] text-white py-3 rounded-xl font-black uppercase text-[10px] hover:bg-[#008f6f] transition-colors">Indisponível</button></div></div><p className="mt-10 text-[11px] font-bold text-slate-400">Pagou? <button onClick={() => window.open('https://wa.me/SEU_ZAP', '_blank')} className="text-[#00a884] underline">Envie o comprovante</button> para liberação imediata.</p></div>
              ) : (
                <div className="space-y-8">
                  {/* Stats e Título */}
                  <div className="grid grid-cols-2 gap-4"><div className="bg-white p-5 rounded-xl border border-slate-200 flex items-center gap-4 shadow-sm"><div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-600"><BarChart3 size={20}/></div><div><span className="block text-xl font-black text-slate-900">{stats.totalSemana}</span><span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Resolvidas</span></div></div><div className="bg-[#00a884] p-5 rounded-xl flex items-center gap-4 shadow-lg shadow-[#00a884]/20 text-white"><div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center"><Target size={20}/></div><div><span className="block text-xl font-black">{stats.taxa}%</span><span className="text-[9px] font-black opacity-80 uppercase tracking-widest">Taxa de Acerto</span></div></div></div>
                  <div className="flex justify-between items-center px-2"><h3 className="font-black text-slate-700 text-sm uppercase tracking-wide flex items-center gap-2"><List size={16} className="text-[#00a884]"/> Caderno de Questões</h3><span className="bg-white text-slate-600 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border border-slate-200 shadow-sm">{questoes.length} Itens</span></div>
                  
                  {/* Lista de Questões */}
                  {questoes.length > 0 ? questionsList(questoes, respostas, editingId, editForm, cancelEditing, handleInlineSave, startEditing, handleInlineDelete, setEditForm, setRespostas, user, carregarStats, atualizarStreak, explicas, setExplicas, isAdmin, handleReportIssue, reportingId, setReportingId) : <div className="text-center py-28 bg-white border border-dashed border-slate-300 rounded-2xl font-bold text-slate-600 italic">Nenhuma questão encontrada nesta página.</div>}

                  {/* RODAPÉ DE PAGINAÇÃO (SOLTO NO FINAL, NÃO FIXO) */}
                  {questoes.length > 0 && (
                    <div className="mt-12 pt-8 border-t border-slate-200 flex justify-center items-center gap-6 pb-8">
                        <button 
                          onClick={() => { 
                            buscarQuestoes(page - 1); 
                            window.scrollTo({ top: 0, behavior: 'smooth' }); // Sobe a tela ao trocar
                          }} 
                          disabled={page === 0}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          <ChevronLeft size={16}/> Anterior
                        </button>
                        
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Página {page + 1}</span>
                          <div className="h-4 w-px bg-slate-300"></div>
                          <select 
                            value={itemsPerPage} 
                            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setPage(0); }}
                            className="bg-transparent text-slate-600 font-bold text-xs outline-none cursor-pointer hover:text-[#00a884]"
                          >
                              <option value={25}>25 itens</option>
                              <option value={50}>50 itens</option>
                          </select>
                        </div>

                        <button 
                          onClick={() => {
                            buscarQuestoes(page + 1);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }} 
                          disabled={!hasMore}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs bg-[#00a884] text-white hover:bg-[#008f6f] shadow-lg shadow-[#00a884]/20 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed transition-all"
                        >
                          Próxima <ChevronRight size={16}/>
                        </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* PAINEL: USUÁRIOS */}
          {abaAdmin === 'usuarios' && isAdmin && (
            <div className="max-w-5xl mx-auto p-12 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm animate-in fade-in">
              <div className="p-4 bg-slate-50 border-b font-black text-[10px] uppercase text-slate-600 tracking-widest">Controle de Assinaturas</div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-100">
                    {listaUsuarios.map(u => { 
                      const hoje = new Date();
                      const exp = u.assinatura?.data_expiracao ? new Date(u.assinatura.data_expiracao) : null;
                      const dataFormatada = exp ? exp.toLocaleDateString('pt-BR') : '-';
                      let textoPrazo = null;
                      let corPrazo = '';
                      if (exp) {
                          const diff = exp.getTime() - hoje.getTime();
                          const dias = Math.ceil(diff / (86400000));
                          if (dias < 0) { textoPrazo = 'Expirado'; corPrazo = 'text-rose-600'; } 
                          else if (dias === 0) { textoPrazo = 'Vence Hoje'; corPrazo = 'text-orange-500'; } 
                          else { textoPrazo = `Falta${dias > 1 ? 'm' : ''} ${dias} dia${dias > 1 ? 's' : ''}`; corPrazo = dias <= 5 ? 'text-orange-500' : 'text-blue-600'; }
                      }
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/30">
                          <td className="p-4 font-bold text-slate-800 text-[12px]">{u.email}</td>
                          <td className="p-4"><span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${u.assinatura?.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'}`}>{u.assinatura?.status || 'pendente'}</span></td>
                          <td className="p-4">
                              <div className="text-[11px] font-mono text-slate-600 mb-0.5 flex items-center gap-1.5"><Clock size={12} className="opacity-50"/> {dataFormatada}</div>
                              {textoPrazo && <div className={`text-[9px] font-black uppercase tracking-wide ${corPrazo}`}>{textoPrazo}</div>}
                          </td>
                          <td className="p-4"><input type="date" className="border border-slate-300 rounded p-1.5 text-[11px]" onChange={(e) => setDatasTemp({...datasTemp, [u.id]: e.target.value})}/></td>
                          <td className="p-4"><button onClick={() => definirValidadeManual(u.id)} className="flex items-center gap-1 bg-[#00a884] text-white px-3 py-1.5 rounded hover:bg-[#008f6f] text-[10px] font-black uppercase transition-all"><Save size={12} /> Salvar</button></td>
                        </tr>
                      ); 
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PAINEL: REPORTES (NOVO) */}
          {abaAdmin === 'reportes' && isAdmin && (
            <div className="max-w-4xl mx-auto p-12 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm animate-in fade-in">
              <div className="p-4 bg-rose-50 border-b border-rose-100 font-black text-[10px] uppercase text-rose-700 tracking-widest flex items-center gap-2"><AlertOctagon size={14}/> Reportes de Erro</div>
              <div className="divide-y divide-slate-100">
                  {listaReportes.length === 0 ? <div className="p-8 text-center text-slate-400 text-xs italic">Nenhum erro reportado.</div> : listaReportes.map(rep => (
                      <div key={rep.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                          <div>
                              <div className="flex items-center gap-2 mb-1">
                                  <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[9px] font-black uppercase">{rep.motivo}</span>
                                  <span className="text-[10px] text-slate-400 font-bold">{new Date(rep.created_at).toLocaleDateString()}</span>
                              </div>
                              <div className="text-xs text-slate-600">
                                  Questão <span className="font-bold text-slate-800">#{rep.questao_id}</span> • {rep.questoes ? `${rep.questoes.disciplina} > ${rep.questoes.tema}` : 'Questão apagada'}
                              </div>
                          </div>
                          <div className="flex gap-2">
                              <button onClick={() => resolverReporte(rep.questao_id, rep.id)} className="px-3 py-1.5 bg-[#00a884] text-white rounded text-[10px] font-black uppercase hover:bg-[#008f6f]">Ver & Corrigir</button>
                              <button onClick={() => apagarReporte(rep.id)} className="px-3 py-1.5 border border-slate-300 text-slate-500 rounded text-[10px] font-black uppercase hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200">Apagar</button>
                          </div>
                      </div>
                  ))}
              </div>
            </div>
          )}

          {/* PAINEL: PADRONIZAÇÃO DE TEMAS (ATUALIZADO PARA EDITAR DISCIPLINA) */}
          {abaAdmin === 'padronizacao' && isAdmin && (
            <div className="max-w-4xl mx-auto p-12 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm animate-in fade-in">
              <div className="p-4 bg-blue-50 border-b border-blue-100 font-black text-[10px] uppercase text-blue-700 tracking-widest flex items-center gap-2"><Tags size={14}/> Limpeza de Tópicos</div>
              <div className="overflow-y-auto max-h-[600px] divide-y divide-slate-100">
                  {listaTemasAdmin.length === 0 ? <div className="p-8 text-center text-slate-400 text-xs italic">Carregando temas...</div> : listaTemasAdmin.map((item, idx) => (
                      <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-50">
                          <div>
                              <span className="block text-[9px] text-slate-400 font-bold uppercase">{item.disciplina}</span>
                              <span className="text-xs font-bold text-slate-700">{item.tema}</span>
                              <span className="ml-2 bg-slate-100 px-1.5 py-0.5 rounded text-[9px] text-slate-500">{item.count} questões</span>
                          </div>
                          <button onClick={() => editarTopico(item.disciplina, item.tema, item.count)} className="px-3 py-1.5 border border-blue-200 text-blue-600 rounded text-[10px] font-black uppercase hover:bg-blue-50 flex items-center gap-1"><Edit size={10}/> Editar / Fundir</button>
                      </div>
                  ))}
              </div>
            </div>
          )}
          
          {/* PAINEL: NOVA QUESTÃO */}
          {abaAdmin === 'questoes' && isAdmin && (
            <form onSubmit={async (e: any) => { 
                e.preventDefault(); 
                await supabase.from('questoes').insert([{ enunciado: fEnun, opcoes: fOps, resposta_correta: fCorr, disciplina: fDisc, tema: fTema, subtema: fSubtema || null, justificativa: fJust, imagem_url: fImg || null, imagem_justificativa: fImgJust || null, ciclo: 'Clínico', origem: fOrigemCadastro }]); 
                setFEnun(''); await buscarDadosEstruturais(); alert("Salvo!"); 
            }} className="max-w-3xl mx-auto p-12 bg-white border border-slate-200 rounded-xl space-y-4 shadow-sm animate-in fade-in">
                <h3 className="text-[10px] font-black text-[#00a884] uppercase tracking-widest border-b pb-2">Nova Questão</h3>
                <textarea placeholder="Enunciado" className="w-full p-3 border border-slate-300 rounded-md text-sm outline-none focus:border-[#00a884]" onChange={e => setFEnun(e.target.value)} value={fEnun} required />
                <div className="grid grid-cols-2 gap-3"><select className="p-3 border border-slate-300 rounded-md text-xs font-bold text-slate-600" onChange={e => setFOrigemCadastro(e.target.value)} value={fOrigemCadastro}><option value="med53">⭐ Original MED53</option><option value="antigas">🏛️ Banca / Antiga</option></select><input placeholder="Disciplina" className="p-3 border border-slate-300 rounded-md text-xs font-bold" onChange={e => setFDisc(e.target.value)} required /></div>
                <div className="grid grid-cols-2 gap-3"><input placeholder="Tema" className="p-3 border border-slate-300 rounded-md text-xs font-bold" onChange={e => setFTema(e.target.value)} required /><input placeholder="Subtema (Opcional)" className="p-3 border border-slate-300 rounded-md text-xs font-bold" onChange={e => setFSubtema(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-2">{fOps.map((op, i) => <input key={i} placeholder={`Opção ${String.fromCharCode(65+i)}`} className="p-2 border border-slate-300 rounded-md text-xs" onChange={e => {const n=[...fOps]; n[i]=e.target.value; setFOps(n);}} required />)}</div>
                <div className="grid grid-cols-2 gap-3"><select className="p-3 border border-slate-300 rounded-md text-xs font-bold" onChange={e => setFCorr(Number(e.target.value))}><option value={0}>Gabarito A</option><option value={1}>Gabarito B</option><option value={2}>Gabarito C</option><option value={3}>Gabarito D</option></select></div>
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-200"><input placeholder="URL da Imagem do ENUNCIADO" className="p-2 border border-slate-300 rounded-md text-xs" onChange={e => setFImg(e.target.value)} /><input placeholder="URL da Imagem da EXPLICAÇÃO" className="p-2 border border-slate-300 rounded-md text-xs" onChange={e => setFImgJust(e.target.value)} /></div>
                <textarea placeholder="Justificativa" className="w-full p-3 border border-slate-300 rounded-md text-xs italic" onChange={e => setFJust(e.target.value)} /><button className="w-full bg-[#00a884] text-white py-3 rounded-md font-black uppercase text-[10px]">Salvar</button>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}

// Sub-componente extraído para limpar o render principal
function questionsList(questoes: any[], respostas: any, editingId: any, editForm: any, cancelEditing: any, handleInlineSave: any, startEditing: any, handleInlineDelete: any, setEditForm: any, setRespostas: any, user: any, carregarStats: any, atualizarStreak: any, explicas: any, setExplicas: any, isAdmin: boolean, handleReportIssue: any, reportingId: any, setReportingId: any) {
    return questoes.map((q, idx) => { 
        const respondida = respostas[q.id] !== undefined;
        const isEditing = editingId === q.id;
        const isReporting = reportingId === q.id;

        return (
          <div key={q.id} className={`bg-white border-l-4 ${isEditing ? 'border-orange-500 ring-2 ring-orange-200' : 'border-[#00a884]'} border-t border-b border-r border-slate-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow mb-8`}>
            
            {isEditing ? (
              <div className="p-6 bg-orange-50 space-y-4 animate-in fade-in">
                <div className="flex justify-between items-center mb-4 border-b border-orange-200 pb-2">
                  <span className="font-black text-orange-600 uppercase text-xs tracking-widest">Editando Questão #{q.id}</span>
                  <button onClick={cancelEditing} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
                </div>
                
                <textarea 
                  value={editForm.enunciado} 
                  onChange={e => setEditForm({...editForm, enunciado: e.target.value})}
                  className="w-full p-3 border border-orange-200 rounded bg-white text-sm font-bold text-slate-700"
                  placeholder="Enunciado da questão..."
                  rows={4}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {editForm.opcoes.map((op: string, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={`font-black text-xs ${i === editForm.resposta_correta ? 'text-green-600' : 'text-slate-400'}`}>{String.fromCharCode(65+i)}</span>
                      <input 
                        value={op}
                        onChange={e => {
                          const novasOps = [...editForm.opcoes];
                          novasOps[i] = e.target.value;
                          setEditForm({...editForm, opcoes: novasOps});
                        }}
                        className={`w-full p-2 border rounded text-xs ${i === editForm.resposta_correta ? 'border-green-400 bg-green-50' : 'border-slate-300'}`}
                      />
                      <input 
                        type="radio" 
                        name={`gabarito-${q.id}`} 
                        checked={i === editForm.resposta_correta} 
                        onChange={() => setEditForm({...editForm, resposta_correta: i})}
                        className="accent-green-600 cursor-pointer"
                        title="Marcar como correta"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <input value={editForm.disciplina} onChange={e => setEditForm({...editForm, disciplina: e.target.value})} className="p-2 border border-slate-300 rounded text-xs" placeholder="Disciplina" />
                  <input value={editForm.tema} onChange={e => setEditForm({...editForm, tema: e.target.value})} className="p-2 border border-slate-300 rounded text-xs" placeholder="Tema" />
                  <input value={editForm.subtema || ''} onChange={e => setEditForm({...editForm, subtema: e.target.value})} className="p-2 border border-slate-300 rounded text-xs" placeholder="Subtema" />
                </div>

                <textarea 
                  value={editForm.justificativa || ''} 
                  onChange={e => setEditForm({...editForm, justificativa: e.target.value})}
                  className="w-full p-3 border border-slate-300 rounded bg-white text-xs italic text-slate-600"
                  placeholder="Comentário/Justificativa..."
                  rows={3}
                />
                
                <div className="grid grid-cols-2 gap-2">
                    <input value={editForm.imagem_url || ''} onChange={e => setEditForm({...editForm, imagem_url: e.target.value})} className="w-full p-2 border border-slate-300 rounded text-xs text-slate-400" placeholder="URL Imagem ENUNCIADO" />
                    <input value={editForm.imagem_justificativa || ''} onChange={e => setEditForm({...editForm, imagem_justificativa: e.target.value})} className="w-full p-2 border border-slate-300 rounded text-xs text-slate-400" placeholder="URL Imagem EXPLICAÇÃO" />
                </div>

                <div className="flex gap-2 pt-2">
                  <button onClick={handleInlineSave} className="flex-1 bg-green-600 text-white py-2 rounded font-black text-xs uppercase hover:bg-green-700 flex items-center justify-center gap-2"><Save size={14}/> Salvar Alterações</button>
                  <button onClick={cancelEditing} className="px-4 py-2 border border-slate-300 rounded text-slate-500 font-bold text-xs uppercase hover:bg-slate-50">Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <div className="px-6 py-3 bg-slate-50/50 flex justify-between items-center border-b border-slate-200 font-black text-slate-700 text-[10px] uppercase">
                  <div className="flex items-center gap-2">
                    <span>Questão {idx + 1}</span>
                    <span className="text-slate-300 hidden sm:inline">|</span>
                    <div className="flex items-center gap-1.5 opacity-60">
                      {q.origem === 'med53' ? <span className="text-[#00a884] flex items-center gap-1"><Star size={10} fill="currentColor"/> MED53</span> : <span className="text-indigo-600 flex items-center gap-1"><Archive size={10}/> BANCA</span>}
                      <span className="text-slate-300">•</span>
                      <span className="truncate max-w-[150px] sm:max-w-none">{q.disciplina} › {q.tema}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {respondida && (<span className={respostas[q.id] === q.resposta_correta ? 'text-[#00a884]' : 'text-rose-600'}>{respostas[q.id] === q.resposta_correta ? '✓ ACERTOU' : '✕ ERROU'}</span>)}
                    {isAdmin && (
                      <div className="flex items-center gap-1 ml-2 border-l pl-3 border-slate-200">
                         <button onClick={() => startEditing(q)} title="Editar" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"><Edit size={14}/></button>
                         <button onClick={() => handleInlineDelete(q.id)} title="Apagar" className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"><Trash2 size={14}/></button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-8">
                    <p className="text-[15.5px] font-bold text-slate-800 leading-relaxed mb-8">{q.enunciado}</p>
                    
                    {/* IMAGEM DO ENUNCIADO (Sempre visível se existir) */}
                    {q.imagem_url && (
                        <div className="mb-8 p-1.5 bg-slate-50 border border-slate-200 rounded-lg shadow-inner">
                            <img src={q.imagem_url} alt="Referência" className="w-full max-h-80 object-contain mx-auto rounded-md" />
                        </div>
                    )}
                    
                    <div className="space-y-2.5">
                        {q.opcoes.map((op: string, i: number) => { 
                            let style = "border-slate-200 bg-[#F9FAFB] text-slate-700 font-bold"; 
                            if (respondida) { 
                              if (i === q.resposta_correta) style = "bg-[#ECFDF5] border-[#00a884] text-[#065F46]"; 
                              else if (respostas[q.id] === i) style = "bg-[#FFF1F2] border-rose-200 text-rose-800"; 
                              else style = "opacity-40 grayscale border-transparent"; 
                            } 
                            return (
                                <button key={i} disabled={respondida} 
                                    onClick={async () => { 
                                        setRespostas((p: any) => ({...p, [q.id]: i})); 
                                        // Salva histórico E atualiza o Streak
                                        await supabase.from('historico_questoes').insert([{ user_id: user.id, questao_id: q.id, acertou: i === q.resposta_correta }]); 
                                        await carregarStats(user.id); 
                                        await atualizarStreak(user.id); // <--- ATUALIZA O STREAK AQUI
                                    }} 
                                    className={`w-full p-4 border rounded-xl text-left flex items-center gap-4 transition-all text-[13.5px] ${style}`}>
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${respondida && i === q.resposta_correta ? 'bg-[#00a884] text-white' : 'bg-white border border-slate-300 text-slate-600'}`}>{String.fromCharCode(65+i)}</span>{op}
                                </button>
                            ); 
                        })}
                    </div>
                    
                    {respondida && (
                      <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col items-end">
                        <div className="flex gap-4 items-center">
                            {/* BOTÃO DE REPORTAR */}
                            <button 
                                onClick={() => setReportingId(isReporting ? null : q.id)} 
                                className="text-slate-400 font-bold text-[10px] uppercase flex items-center gap-1 hover:text-rose-500 transition-colors"
                            >
                                <Flag size={12}/> Reportar Erro
                            </button>

                            <button onClick={() => setExplicas((p: any) => ({...p, [q.id]: !p[q.id]}))} className="text-[#00a884] font-black text-[10px] uppercase flex items-center gap-2 hover:underline transition-all"><Eye size={16}/> {explicas[q.id] ? 'Fechar' : 'Ver Explicação'}</button>
                        </div>

                        {/* ÁREA DE REPORTE */}
                        {isReporting && (
                            <div className="mt-4 p-4 bg-rose-50 border border-rose-100 rounded-lg w-full animate-in fade-in slide-in-from-top-2">
                                <span className="block text-xs font-black text-rose-800 mb-3">Qual o problema desta questão?</span>
                                <div className="grid grid-cols-2 gap-2">
                                    {['Gabarito Errado', 'Erro de Português', 'Imagem Ruim', 'Outro'].map(motivo => (
                                        <button 
                                            key={motivo}
                                            onClick={() => handleReportIssue(q.id, motivo)}
                                            className="bg-white border border-rose-200 text-rose-700 py-2 rounded text-[10px] font-bold uppercase hover:bg-rose-600 hover:text-white transition-colors"
                                        >
                                            {motivo}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {explicas[q.id] && (
                            <div className="w-full mt-6 p-7 bg-slate-50 border border-slate-200 rounded-lg text-[13.5px] text-slate-700 leading-relaxed italic shadow-inner animate-in fade-in">
                                <div className="flex items-center gap-2 mb-3 text-[#00a884] font-black text-[10px] uppercase border-b border-[#00a884]/10 pb-1.5 tracking-widest"><Info size={14}/> Comentário Técnico</div>
                                {q.justificativa}
                                {/* IMAGEM DA EXPLICAÇÃO (Nova!) */}
                                {q.imagem_justificativa && (
                                    <div className="mt-4 pt-4 border-t border-slate-200">
                                        <img src={q.imagem_justificativa} alt="Explicação Visual" className="w-full max-h-60 object-contain mx-auto rounded-md opacity-90" />
                                    </div>
                                )}
                            </div>
                        )}
                      </div>
                    )}
                </div>
              </>
            )}
          </div>
        ); 
    });
}