

// ======================================================================
// ESTADO GLOBAL
// grupos: array de paradas. Cada parada:
// { id, stop, endereco, lat, lng, pacotes:[{codigo,endereco,stop}],
//   status: 'pendente' | 'entregue' | 'ocorrencia', motivo: string|null }
// ======================================================================

let grupos = [];
let mapa = null;
let marcadores = {};
let meuMarcador = null;
let circuloPrecisaoUsuario = null;
let idRastreamento = null;
let precisaoLocalizacaoMetros = null;
let ultimaPosicaoUsuario = null;
let localizacaoManualAtiva = false;
let modoAjustePosicaoManual = false;
let primeiraCentralizacaoGPSFeita = false;
// (alvoAguardandoMotivo é declarado mais abaixo, junto da lógica de status)
function iconeLinha(nome, classe='mini'){return `<svg class="ui-icon ${classe||''}" aria-hidden="true"><use href="#icon-${nome}"></use></svg>`;}
function textoSemEmoji(texto){return String(texto||'').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,'').replace(/[\uFE0F\u200D]/g,'').replace(/\s{2,}/g,' ').trim();}
function selecionarArquivoRota(){const input=document.getElementById('arquivo');if(input) input.click();}
let sheetListaMapaAberto=false;
let sheetTouchInicioY=null;
let gestoBordaMapaInicioY=null;
function ehLayoutMobileV10(){return window.matchMedia('(max-width: 799px)').matches;}
function definirSheetListaMapa(aberto){
sheetListaMapaAberto=!!aberto;
const sheet=document.getElementById('sheetListaMapa');
if(sheet) sheet.classList.toggle('aberto',sheetListaMapaAberto);
}
function alternarSheetListaMapa(){definirSheetListaMapa(!sheetListaMapaAberto);}
function iniciarGestosSheetListaMapa(){
const sheet=document.getElementById('sheetListaMapa');
const alca=document.getElementById('alcaListaMapa');
const painel=document.getElementById('painelMapa');
if(!sheet||!alca||sheet.dataset.gestos==='1')return;
sheet.dataset.gestos='1';
alca.addEventListener('touchstart',e=>{sheetTouchInicioY=e.touches&&e.touches[0]?e.touches[0].clientY:null;},{passive:true});
alca.addEventListener('touchend',e=>{if(sheetTouchInicioY===null)return;const y=e.changedTouches&&e.changedTouches[0]?e.changedTouches[0].clientY:sheetTouchInicioY;const d=y-sheetTouchInicioY;if(d<-28)definirSheetListaMapa(true);else if(d>28)definirSheetListaMapa(false);sheetTouchInicioY=null;},{passive:true});
if(painel){
painel.addEventListener('touchstart',e=>{
if(!ehLayoutMobileV10()||sheetListaMapaAberto)return;
const t=e.touches&&e.touches[0];if(!t)return;
const r=painel.getBoundingClientRect();
gestoBordaMapaInicioY=(t.clientY>=r.bottom-105)?t.clientY:null;
},{passive:true,capture:true});
painel.addEventListener('touchend',e=>{
if(gestoBordaMapaInicioY===null)return;
const t=e.changedTouches&&e.changedTouches[0];
const y=t?t.clientY:gestoBordaMapaInicioY;
if(y-gestoBordaMapaInicioY<-48) definirSheetListaMapa(true);
gestoBordaMapaInicioY=null;
},{passive:true,capture:true});
}
}
function abrirListaMapaNoGrupo(id){irParaAba(1);definirSheetListaMapa(true);setTimeout(()=>destacarElemento('grupo_'+id),260);}

let abaAtual = 0; // 0 = Lista, 1 = Mapa, 2 = Ocorrências
let mapaFoiEnquadrado = false; // controla se já demos fitBounds (evita resetar o zoom)
let celebracaoMostrada = false; // evita repetir a comemoração de rota 100% toda hora
let marcosMostrados = new Set(); // marcos de progresso (25/50/75%) já avisados nesta rota
let recordeAvisado = false; // evita repetir o aviso de recorde do dia várias vezes
const HISTORICO_STORAGE_KEY = "copiloto_entregas_historico";
const SOM_STORAGE_KEY = "copiloto_entregas_som_ativado";
const CHAVE_STORAGE = "copiloto_entregas_rota_atual";
const META_ROTA_STORAGE_KEY = "copiloto_entregas_meta_rota_v7";
const OTIMIZACAO_PREF_KEY = "copiloto_entregas_otimizacao_pref_v7_2";
const OTIMIZACAO_PRIMEIRA_ESCOLHA_KEY = "copiloto_entregas_otimizacao_primeira_escolha_v7_2";
const DESTINOS_SALVOS_KEY = "copiloto_entregas_destinos_salvos";
const DESTINOS_SALVOS_LEGADO_KEY = "copiloto_entregas_destinos_salvos_v7_1";
const CONFIG_OTIMIZACAO_V9_KEY = "copiloto_entregas_config_otimizacao_v9_1";

let metaRota = {
modo:null,
provedor:'OSRM',
distanciaMetros:null,
duracaoSegundos:null,
distanciaShopeeMetros:null,
duracaoShopeeSegundos:null,
destinoFinal:null,
organizacaoPacotesConcluida:false,
atualizadoEm:null
};
let modalOtimizacaoEmModoConfiguracao = false;
let marcadorDestinoRota = null;
let mapaDestinoFinal = null;
let marcadorDestinoSelecionado = null;
let destinoSelecionadoAtual = null;

// V8.2 - editor manual fiel por desenho + rota encaixada nas ruas.
let modoDesenhoRota = false;
let desenhandoRota = false;
let pontosDesenhoRota = [];
let linhaDesenhoRota = null;
let linhaDesenhoSalva = null;
let marcadorInicioDesenho = null;
let marcadorFimDesenho = null;
let capturasDesenhoRota = new Map();
let comprimentoDesenhoPx = 0;
let ultimoPontoDesenhoPx = null;
let eventosDesenhoInstalados = false;
let tracosDesenhoRota = [];
let linhasTracosDesenho = [];
let tracoAtualDesenho = null;
let baseProgressoTracoAtual = 0;
let linhaTracoAtual = null;
let modoInteracaoDesenho = 'desenhar';
let linhaRotaGps = null;
let linhaRotaGpsContorno = null;
let modoOrganizacaoPacotes = false;

// ----------------------------------------------------------------------
// IMPORTAÇÃO DA PLANILHA
// ----------------------------------------------------------------------

function importarExcel(){

const arquivo =
document.getElementById("arquivo").files[0];


if(!arquivo){

alert("Selecione a planilha");
return;

}

const reader = new FileReader();

reader.onload = function(e){

const data =
new Uint8Array(e.target.result);

const workbook =
XLSX.read(data,{type:'array'});

const sheet =
workbook.Sheets[
workbook.SheetNames[0]
];

const json =
XLSX.utils.sheet_to_json(sheet);

processarEntregas(json);

};
reader.readAsArrayBuffer(arquivo);

}


// ----------------------------------------------------------------------
// V7.5 - RESTRIÇÕES OPERACIONAIS OPCIONAIS
// A planilha atual da Shopee normalmente não traz janelas de horário. Estas
// regras só entram em ação quando houver colunas compatíveis; nada é inventado.
// ----------------------------------------------------------------------

function primeiroValorPlanilha(item, nomes){
for(const nome of nomes){
const valor = item ? item[nome] : null;
if(valor !== undefined && valor !== null && String(valor).trim() !== '') return valor;
}
return null;
}

function horaParaMinutos(valor){
if(valor === undefined || valor === null || valor === '') return null;
if(valor instanceof Date && !isNaN(valor.getTime())) return valor.getHours()*60 + valor.getMinutes();

if(typeof valor === 'number' && Number.isFinite(valor)){
// Excel pode entregar horários como fração de um dia ou serial com fração.
const fracao = valor >= 0 ? valor % 1 : 0;
if(fracao > 0 || (valor >= 0 && valor < 1)) return Math.round(fracao * 24 * 60);
}

const txt = String(valor).trim().toLowerCase();
const m = txt.match(/(?:^|\D)([01]?\d|2[0-3])\s*(?::|h)\s*([0-5]\d)?/i);
if(m) return Number(m[1])*60 + Number(m[2] || 0);
return null;
}

function janelaPreferencialTexto(valor){
if(valor === undefined || valor === null || valor === '') return {inicio:null,fim:null};
const txt = normalizarTexto(String(valor));
if(/manha/.test(txt)) return {inicio:8*60,fim:12*60};
if(/tarde/.test(txt)) return {inicio:12*60,fim:18*60};
if(/noite/.test(txt)) return {inicio:18*60,fim:22*60};

const encontrados = [...String(valor).matchAll(/([01]?\d|2[0-3])\s*(?::|h)\s*([0-5]\d)?/gi)]
.map(m=>Number(m[1])*60 + Number(m[2] || 0));
if(encontrados.length >= 2) return {inicio:encontrados[0],fim:encontrados[1]};
return {inicio:null,fim:null};
}

function enderecoParecePredio(endereco){
const txt = normalizarTexto(endereco);
return /\b(apto|apartamento|bloco|condominio|condominio|edificio|residencial|torre|unidade)\b/.test(txt);
}

function extrairRestricoesOperacionaisLinha(item, endereco){
const hardBruto = primeiroValorPlanilha(item,[
'Horário Limite','Horario Limite','Entrega até','Entrega ate','Deadline',
'Delivery Deadline','Time Window End','Janela Fim','End Time'
]);

const softBruto = primeiroValorPlanilha(item,[
'Janela Preferencial','Preferência de Horário','Preferencia de Horario',
'Preferred Time','Preferred Window','Preference'
]);
const softInicioBruto = primeiroValorPlanilha(item,[
'Janela Preferencial Início','Janela Preferencial Inicio','Preferred Start','Time Window Start'
]);
const softFimBruto = primeiroValorPlanilha(item,[
'Janela Preferencial Fim','Preferred End'
]);

let soft = janelaPreferencialTexto(softBruto);
const inicioSeparado = horaParaMinutos(softInicioBruto);
const fimSeparado = horaParaMinutos(softFimBruto);
if(Number.isFinite(inicioSeparado)) soft.inicio = inicioSeparado;
if(Number.isFinite(fimSeparado)) soft.fim = fimSeparado;

const servicoBruto = primeiroValorPlanilha(item,[
'Tempo de Serviço (min)','Tempo de Servico (min)','Tempo de Serviço','Tempo de Servico',
'Service Time (min)','Service Minutes','Service Time'
]);
let servicoSegundos = null;
const nServico = Number(String(servicoBruto ?? '').replace(',','.'));
if(Number.isFinite(nServico) && nServico > 0 && nServico <= 180) servicoSegundos = Math.round(nServico*60);

// Regra solicitada para o teste: casa = 2 min; prédio/condomínio = 7 min.
if(!Number.isFinite(servicoSegundos)) servicoSegundos = enderecoParecePredio(endereco) ? 7*60 : 2*60;

return {
janelaHardMin:horaParaMinutos(hardBruto),
janelaSoftInicioMin:Number.isFinite(soft.inicio) ? soft.inicio : null,
janelaSoftFimMin:Number.isFinite(soft.fim) ? soft.fim : null,
tempoServicoSegundos:servicoSegundos
};
}

function combinarRestricoesGrupo(grupo, restricao){
if(!grupo || !restricao) return;

if(Number.isFinite(restricao.janelaHardMin)){
grupo.janelaHardMin = Number.isFinite(grupo.janelaHardMin)
? Math.min(grupo.janelaHardMin, restricao.janelaHardMin)
: restricao.janelaHardMin;
}

// Preferência soft: quando vários pacotes no mesmo local têm janelas, usamos
// a interseção possível. Se forem conflitantes, preservamos a primeira em vez
// de inventar uma preferência nova.
if(Number.isFinite(restricao.janelaSoftInicioMin) && Number.isFinite(restricao.janelaSoftFimMin)){
if(!Number.isFinite(grupo.janelaSoftInicioMin) || !Number.isFinite(grupo.janelaSoftFimMin)){
grupo.janelaSoftInicioMin = restricao.janelaSoftInicioMin;
grupo.janelaSoftFimMin = restricao.janelaSoftFimMin;
}else{
const inicio = Math.max(grupo.janelaSoftInicioMin, restricao.janelaSoftInicioMin);
const fim = Math.min(grupo.janelaSoftFimMin, restricao.janelaSoftFimMin);
if(inicio <= fim){
grupo.janelaSoftInicioMin = inicio;
grupo.janelaSoftFimMin = fim;
}
}
}

if(Number.isFinite(restricao.tempoServicoSegundos)){
grupo.tempoServicoSegundos = Math.max(Number(grupo.tempoServicoSegundos)||0, restricao.tempoServicoSegundos);
}
}

async function processarEntregas(dados){

// Nova planilha = nova rota (zera tudo, inclusive o que estava salvo)
const baldes = {}; // agrupados primeiro por número de Parada (ou "EXTRA")

document.getElementById("pacotes").innerText =
dados.length;

dados.forEach(item=>{

const endereco =
item["Destination Address"] ||
item["Address"] ||
"-";

const restricoesOperacionais = extrairRestricoesOperacionaisLinha(item, endereco);

const bairro =
item["Bairro"] ||
item["Neighborhood"] ||
"";

const cidade =
item["City"] ||
item["Cidade"] ||
"";

const cep =
item["Zipcode/Postal code"] ||
item["Zipcode"] ||
item["CEP"] ||
"";

const codigo =
item["SPX TN"] ||
item["SPX_TN"] ||
"-";

const destinatario =
item["Recipient"] ||
item["Recipient Name"] ||
item["Consignee"] ||
item["Consignee Name"] ||
item["Nome"] ||
item["Nome do Destinatário"] ||
item["Customer Name"] ||
item["Buyer Name"] ||
"";

const lat =
item["Latitude"] ||
"";

const lng =
item["Longitude"] ||
"";

const stopOriginal =
item["Stop"] ||
item["stop"] ||
"";

const stopTexto = String(stopOriginal).trim();

const paradaBase = stopTexto
.replace(/[A-Za-z]$/,"")
.trim();

// Balde inicial: mesmo número de Parada já é um forte indício de ser o
// mesmo local. Dentro do balde, decide-se se é "o mesmo lugar de fato"
// pela função paradasMesmoLocal (unidade/apto -> depois distância real).
const chaveBalde = stopTexto ? ("STOP|" + paradaBase) : "EXTRA";

if(!baldes[chaveBalde]) baldes[chaveBalde] = [];

const candidato = { endereco:endereco, lat:lat, lng:lng };

let cluster = baldes[chaveBalde].find(c => paradasMesmoLocal(c.representante, candidato));

if(!cluster){

cluster = {
representante: candidato,
grupo: {
id: chaveBalde + "#" + (baldes[chaveBalde].length + 1),
endereco:endereco,
lat:lat,
lng:lng,
stop:paradaBase,
stopOriginal:paradaBase,
ordemOtimizada:null,
destinatario:destinatario,
bairro:bairro,
cidade:cidade,
cep:cep,
janelaHardMin:null,
janelaSoftInicioMin:null,
janelaSoftFimMin:null,
tempoServicoSegundos:null,
pacotes:[]
// status não fica mais aqui - é calculado por pacote (ver statusEfetivoGrupo)
}
};

baldes[chaveBalde].push(cluster);

}

if(!cluster.grupo.destinatario && destinatario){
cluster.grupo.destinatario = destinatario;
}

combinarRestricoesGrupo(cluster.grupo, restricoesOperacionais);

cluster.grupo.pacotes.push({

codigo:codigo,
endereco:endereco,
stop:stopTexto,
destinatario:destinatario,
telefone:String(primeiroValorPlanilha(item,['Telefone','Phone','Phone Number','Recipient Phone','Celular'])||''),
status:'pendente',
motivo:null,
organizadoCarro:false

});

});

grupos = [];
Object.values(baldes).forEach(lista => lista.forEach(c => grupos.push(c.grupo)));
grupos.forEach((g, indice) => {
if(!Number.isFinite(g.indiceImportacao)) g.indiceImportacao = indice;
});

mapaFoiEnquadrado = false; // nova rota -> próximo enquadramento do mapa deve se ajustar às novas paradas
celebracaoMostrada = false; // nova rota -> pode comemorar de novo quando terminar essa
marcosMostrados = new Set(); // nova rota -> pode avisar os marcos de progresso de novo
recordeAvisado = false; // nova rota -> pode avisar recorde de novo
painelPacotesAbertos = new Set(); // nova rota -> nenhum painel deve começar aberto

metaRota = {
modo:null,
provedor:'OSRM',
distanciaMetros:null,
duracaoSegundos:null,
distanciaShopeeMetros:null,
duracaoShopeeSegundos:null,
destinoFinal:null,
atualizadoEm:null
};

salvarStorage();

// V8.1: importar uma rota NÃO dispara qualquer otimização automática.
// Apenas corrigimos coordenadas ausentes e mostramos a ordem original da Shopee.
abrirOverlayOtimizacao('Preparando os endereços da rota...');
await corrigirCoordenadasAusentes({renderizar:false, silencioso:true});
fecharOverlayOtimizacao();

grupos.sort((a,b)=>(a.indiceImportacao ?? 0) - (b.indiceImportacao ?? 0));
grupos.forEach(g=>{ g.ordemOtimizada = null; });
metaRota = {
modo:'shopee',
provedor:null,
distanciaMetros:null,
duracaoSegundos:null,
distanciaShopeeMetros:null,
duracaoShopeeSegundos:null,
destinoFinal:null,
organizacaoPacotesConcluida:false,
atualizadoEm:Date.now()
};
salvarStorage();
renderizarTudo();
const campoArquivo=document.getElementById('arquivo'); if(campoArquivo) campoArquivo.value='';

// V10.3: a importação já executa automaticamente o modo escolhido nas configurações.
// No modo "Não otimizar", a ordem original é mantida sem qualquer cálculo de rota.
const configImportacao=carregarConfiguracaoV9();
if(configImportacao.modo==='nenhuma'){
mostrarToast('Rota importada na ordem original','sucesso');
}else{
mostrarToast('Rota importada. Otimizando automaticamente...','neutro');
await executarOtimizacaoPrincipalV9();
}

}

// ----------------------------------------------------------------------
// CORREÇÃO DE COORDENADAS AUSENTES/ERRADAS A PARTIR DO ENDEREÇO
// Só entra em ação quando a Latitude/Longitude da planilha está vazia
// ou claramente fora do Brasil - não mexe em coordenadas que já parecem
// corretas, pra não gastar tempo/cota à toa.
// ----------------------------------------------------------------------

function coordenadaValida(lat, lng){
const latN = parseFloat(lat);
const lngN = parseFloat(lng);
if(isNaN(latN) || isNaN(lngN)) return false;
if(latN === 0 && lngN === 0) return false;
// faixa aproximada do território brasileiro
if(latN > 6 || latN < -34 || lngN > -30 || lngN < -75) return false;
return true;
}

function esperar(ms){
return new Promise(resolver => setTimeout(resolver, ms));
}

// V10.3 - NORMALIZAÇÃO DE ENDEREÇOS
// Expande abreviações brasileiras comuns de logradouro antes de consultar
// o geocodificador. O endereço original continua intacto para exibição.
const REGRAS_LOGRADOURO = [
{re:/^(?:av\.?|aven\.?|avenida)\s+/i, nome:'Avenida '},
{re:/^(?:r\.?|rua)\s+/i, nome:'Rua '},
{re:/^(?:rod\.?|rodovia)\s+/i, nome:'Rodovia '},
{re:/^(?:est\.?|estr\.?|estrada)\s+/i, nome:'Estrada '},
{re:/^(?:tv\.?|trav\.?|travessa)\s+/i, nome:'Travessa '},
{re:/^(?:al\.?|alameda)\s+/i, nome:'Alameda '},
{re:/^(?:pca\.?|pça\.?|praca|praça)\s+/i, nome:'Praça '},
{re:/^(?:lgo\.?|lg\.?|largo)\s+/i, nome:'Largo '},
{re:/^(?:serv\.?|servidao|servidão)\s+/i, nome:'Servidão '},
{re:/^(?:psg\.?|passagem)\s+/i, nome:'Passagem '},
{re:/^(?:ac\.?|acesso)\s+/i, nome:'Acesso '},
{re:/^(?:beco|bc\.?)\s+/i, nome:'Beco '}
];

function expandirAbreviacaoLogradouro(texto){
let valor = String(texto || '').trim().replace(/\s+/g,' ');
if(!valor) return '';
for(const regra of REGRAS_LOGRADOURO){
if(regra.re.test(valor)) return valor.replace(regra.re, regra.nome);
}
return valor;
}

function limparEnderecoParaGeocodificacao(texto){
let valor = expandirAbreviacaoLogradouro(texto);
if(!valor) return '';

// "S/N" não ajuda o geocodificador e pode atrapalhar a interpretação.
valor = valor
.replace(/\s*,?\s*\b(?:s\s*[\/.]?\s*n|sn|sem\s+n[uú]mero)\b\.?/gi, '')
// Remove instruções de entrega comuns que não fazem parte do endereço.
.replace(/\s*[,;|–—-]\s*(?:procurar\s+por|ponto\s+de\s+refer[eê]ncia|refer[eê]ncia|obs(?:erva[cç][aã]o)?|entregar\s+(?:em|no|na)|deixar\s+(?:em|no|na)|falar\s+com|chamar\s+no|interfone|port[aã]o)\b.*$/i, '')
.replace(/\s*,\s*,+/g, ', ')
.replace(/\s+/g, ' ')
.replace(/^[,;\s]+|[,;\s]+$/g, '')
.trim();
return valor;
}

function normalizarConsultaGeocodificacao(consulta){
// Trabalha sobre a consulta inteira para também remover "S/N" e instruções
// quando vierem em segmentos separados por vírgula. Cidade/bairro/CEP permanecem.
return limparEnderecoParaGeocodificacao(String(consulta || ''));
}

// Monta uma consulta completa e já normalizada (logradouro, bairro, cidade, CEP).
// Ex.: "AV. Brasil" -> "Avenida Brasil"; "R João" -> "Rua João".
function montarConsultaEndereco(grupo){
const endereco = limparEnderecoParaGeocodificacao(grupo.endereco);
const partes = [endereco, grupo.bairro, grupo.cidade, grupo.cep]
.filter(p => p && String(p).trim() && String(p).trim() !== "-");
return partes.join(", ");
}

async function geocodificarEndereco(consulta){
const original = String(consulta || '').trim();
const normalizada = normalizarConsultaGeocodificacao(original);
const candidatas = [...new Set([normalizada, original].filter(Boolean))];

for(let i=0;i<candidatas.length;i++){
const tentativa = candidatas[i];
try{
const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=" + encodeURIComponent(tentativa);
const resposta = await fetch(url, { headers: { "Accept-Language": "pt-BR" } });
if(resposta.ok){
const dados = await resposta.json();
if(dados && dados.length > 0){
return { lat: dados[0].lat, lng: dados[0].lon, consultaUsada: tentativa };
}
}
}catch(erro){
console.warn("Falha ao buscar coordenada para:", tentativa, erro);
}
// Se a versão normalizada não encontrar, tentamos o texto original sem
// desrespeitar o intervalo usado pelo geocodificador público.
if(i < candidatas.length - 1) await esperar(1100);
}
return null;
}

async function corrigirCoordenadasAusentes(opcoes = {}){

const candidatos = grupos.filter(g => !coordenadaValida(g.lat, g.lng));

if(candidatos.length === 0) return;

if(!opcoes.silencioso) mostrarToast(`🔍 Corrigindo ${candidatos.length} coordenada(s)...`, 'neutro');

let corrigidas = 0;

for(const grupo of candidatos){

const resultado = await geocodificarEndereco(montarConsultaEndereco(grupo));

if(resultado){
grupo.lat = resultado.lat;
grupo.lng = resultado.lng;
corrigidas++;
}

// Respeita o limite de uso do serviço gratuito (1 consulta por segundo)
await esperar(1100);

}

if(corrigidas > 0){
salvarStorage();
if(opcoes.renderizar !== false) renderizarTudo();
if(!opcoes.silencioso) mostrarToast(`✅ ${corrigidas} coordenada(s) corrigida(s)`, 'sucesso');
}

}

// Verificação sob demanda de UMA parada específica, acionada pelo botão
// "🔍 Verificar localização" no painel do mapa. Sempre busca de novo,
// mesmo que a coordenada atual pareça válida - útil quando o pin está
// no lugar errado mas dentro do Brasil (então a checagem automática
// da importação não pegaria isso sozinha).
async function verificarLocalizacaoPin(id){

const grupo = encontrarGrupo(id);
if(!grupo) return;

fecharInfoMapa();
mostrarToast('🔍 Verificando localização...', 'neutro');

const resultado = await geocodificarEndereco(montarConsultaEndereco(grupo));

if(!resultado){
mostrarToast('⚠️ Não foi possível verificar - endereço não encontrado', 'alerta');
return;
}

const latAntiga = parseFloat(grupo.lat);
const lngAntiga = parseFloat(grupo.lng);
const latNova = parseFloat(resultado.lat);
const lngNova = parseFloat(resultado.lng);

const distanciaMudanca = (!isNaN(latAntiga) && !isNaN(lngAntiga))
? distanciaMetros(latAntiga, lngAntiga, latNova, lngNova)
: null;

grupo.lat = resultado.lat;
grupo.lng = resultado.lng;
salvarStorage();
renderizarTudo();

// Leva o mapa até onde o pin ficou, pra você ver na hora pra onde ele foi
mapa.setView([latNova, lngNova], Math.max(mapa.getZoom(), 17));
setTimeout(()=> destacarMarcador(grupo.id), 150);

if(distanciaMudanca !== null && distanciaMudanca < 15){
mostrarToast('✅ Já estava correto - nada mudou', 'sucesso');
}else{
mostrarToast('✅ Pin corrigido - mapa levado até a nova posição', 'sucesso');
}

}


// ======================================================================
// V8.1 - EDITOR MANUAL DE ROTA POR DESENHO + ENCAIXE NAS RUAS
// ======================================================================
/*
O desenho representa a ORDEM escolhida pelo motorista.
- O início real da rota é sempre a localização atual do usuário.
- O usuário pode desenhar vários traços, mover/zoomar o mapa e continuar.
- TODAS as paradas com coordenada válida precisam ser atravessadas pelo desenho.
- Parada não selecionada nunca é encaixada automaticamente: ela pulsa no mapa
  e a aplicação é bloqueada até o motorista incluí-la.
- A ordem capturada é preservada. Apenas um bloco consecutivo da MESMA rua
  pode ser invertido quando a matriz viária comprovar uma economia clara.
- Após aplicar, o rabisco desaparece e o mapa mostra a rota REAL encaixada
  nas ruas pelo OSRM, partindo da localização atual e terminando na última
  entrega da nova ordem.
*/

function iniciarDesenhoOtimizacao(){
if(!grupos.length){
mostrarToast('⚠️ Importe uma rota antes de desenhar a ordem', 'alerta');
return;
}
irParaAba(1);
setTimeout(()=>ativarModoDesenhoRota(), 180);
}

function ativarModoDesenhoRota(){
inicializarMapaSeNecessario();
if(!mapa) return;
fecharInfoMapa();
modoDesenhoRota = true;
desenhandoRota = false;
limparDesenhoOtimizacao(true);
const painel = document.getElementById('painelDesenhoRota');
if(painel) painel.classList.add('aberto');
const botao = document.getElementById('botaoDesenharRotaMapa');
if(botao) botao.classList.add('ativo');
definirModoInteracaoDesenho('desenhar');
removerLinhaRotaGpsV81();
atualizarInstrucaoDesenho('O início real é sua localização. Desenhe um ou mais corredores; use “Mover mapa” quando precisar reposicionar e depois continue desenhando.');
atualizarDestaqueFaltantesDesenhoV82();
}

function definirModoInteracaoDesenho(modo){
modoInteracaoDesenho = modo === 'mover' ? 'mover' : 'desenhar';
if(desenhandoRota) desenhandoRota=false;
const bD=document.getElementById('btnModoDesenharRota');
const bM=document.getElementById('btnModoMoverRota');
if(bD) bD.classList.toggle('ativo', modoInteracaoDesenho==='desenhar');
if(bM) bM.classList.toggle('ativo', modoInteracaoDesenho==='mover');
const mapaEl=document.getElementById('mapa');
if(mapaEl) mapaEl.classList.toggle('modo-desenho-rota', modoInteracaoDesenho==='desenhar');
configurarInteracoesMapaDuranteDesenho(modoInteracaoDesenho==='mover');
if(modoInteracaoDesenho==='mover') atualizarInstrucaoDesenho('✋ Mova ou dê zoom no mapa. Quando estiver pronto, toque em “✏️ Desenhar” e continue; os traços anteriores permanecem.');
else atualizarInstrucaoDesenho(tracosDesenhoRota.length ? '✏️ Continue desenhando. Os traços anteriores continuam valendo na mesma sequência.' : '✏️ Desenhe os corredores na ordem em que você pretende percorrê-los.');
}

function configurarInteracoesMapaDuranteDesenho(habilitar){
if(!mapa) return;
const metodos=['dragging','touchZoom','doubleClickZoom','scrollWheelZoom','boxZoom','keyboard','touchRotate'];
metodos.forEach(nome=>{
const obj=mapa[nome];
if(obj && typeof obj[habilitar ? 'enable' : 'disable']==='function'){
try{ obj[habilitar ? 'enable' : 'disable'](); }catch(erro){}
}
});
}

function atualizarInstrucaoDesenho(texto){
const el=document.getElementById('instrucaoDesenhoRota');
if(el) el.textContent=textoSemEmoji(texto);
}

function paradaParticipaDoDesenhoV84(grupo){
// Paradas totalmente entregues não fazem mais parte da rota pendente e,
// portanto, não devem impedir a aplicação de um novo desenho.
try{ return statusEfetivoGrupo(grupo) !== 'entregue'; }
catch(e){ return true; }
}

function paradaTemCoordenadaValidaV84(grupo){
// V8.7: nunca use Number("") para validar coordenadas, porque Number("")
// vira 0 e criava uma parada "fantasma" obrigatória que não tinha pin no mapa.
// Reutilizamos a validação geográfica já usada pelo Copiloto.
try{ return coordenadaValida(grupo && grupo.lat, grupo && grupo.lng); }
catch(e){
const lat=parseFloat(grupo && grupo.lat),lng=parseFloat(grupo && grupo.lng);
return Number.isFinite(lat)&&Number.isFinite(lng)&&!(lat===0&&lng===0);
}
}

function paradaTemMarcadorDesenhavelV87(grupo){
if(!grupo || !marcadores) return false;
const m=marcadores[grupo.id];
if(!m || typeof m.getLatLng!=='function') return false;
const ll=m.getLatLng();
return !!ll && Number.isFinite(Number(ll.lat)) && Number.isFinite(Number(ll.lng));
}

function paradasValidasDesenhoV82(){
// Fonte única da verdade para o desenho: somente paradas ATIVAS que possuem
// coordenada utilizável E um pin realmente renderizado no mapa podem ser
// obrigatórias. Assim não existe mais "faltam 1" para uma parada invisível.
return grupos.filter(g=>
paradaParticipaDoDesenhoV84(g) &&
paradaTemCoordenadaValidaV84(g) &&
paradaTemMarcadorDesenhavelV87(g)
);
}

function paradasAtivasSemCoordenadaV84(){
return grupos.filter(g=>paradaParticipaDoDesenhoV84(g)&&!paradaTemCoordenadaValidaV84(g));
}

function paradasAtivasSemMarcadorV87(){
return grupos.filter(g=>
paradaParticipaDoDesenhoV84(g) &&
paradaTemCoordenadaValidaV84(g) &&
!paradaTemMarcadorDesenhavelV87(g)
);
}

function paradasFaltantesDesenhoV82(){
return paradasValidasDesenhoV82().filter(g=>!capturasDesenhoRota.has(g.id));
}

// V8.7 - SELEÇÃO EXATA PELO PIN VISUAL
// Uma parada só é selecionada quando a linha desenhada realmente atravessa
// o círculo visível do pin. "Passar perto" não conta.
const RAIO_VISUAL_PIN_DESENHO_V86 = 12; // raio do corpo circular de 24px
const METADE_LINHA_DESENHO_V86 = 2.5;   // linha azul tem 5px
const LIMIAR_CAPTURA_PIN_PX_V86 = RAIO_VISUAL_PIN_DESENHO_V86 + METADE_LINHA_DESENHO_V86;

function centroVisualPinDesenhoV86(grupo){
if(!mapa) return null;
const marcador=marcadores[grupo.id];
const container=mapa.getContainer();
if(marcador && container && typeof marcador.getElement==='function'){
const el=marcador.getElement();
const corpo=el ? el.querySelector('.pin-corpo') : null;
if(corpo){
const r=corpo.getBoundingClientRect();
const mr=container.getBoundingClientRect();
if(r.width>0 && r.height>0){
return L.point((r.left+r.right)/2-mr.left,(r.top+r.bottom)/2-mr.top);
}
}
}
// Fallback: o anchor do Leaflet fica na ponta inferior do pin; o centro do
// círculo fica aproximadamente 22px acima dessa ponta.
const lat=Number(grupo.lat),lng=Number(grupo.lng);
if(!Number.isFinite(lat)||!Number.isFinite(lng)) return null;
const ancora=mapa.latLngToContainerPoint([lat,lng]);
return L.point(ancora.x,ancora.y-22);
}

function atualizarClasseCapturaPinV86(id){
const m=marcadores[id];
const el=m&&m.getElement?m.getElement():null;
const pin=el?el.querySelector('.pin-mapa'):null;
if(!pin) return;
const capturado=capturasDesenhoRota.has(id);
pin.classList.toggle('capturado-desenho',capturado);
pin.classList.toggle('nao-selecionado-desenho',modoDesenhoRota&&!capturado&&paradasValidasDesenhoV82().some(g=>g.id===id));
}

function capturarPinsNoTracoV86(traco,baseProgresso){
if(!mapa || !Array.isArray(traco) || traco.length<2) return;
const candidatos=paradasValidasDesenhoV82().filter(g=>!capturasDesenhoRota.has(g.id));
if(!candidatos.length) return;

let acumuladoLocal=0;
const segmentos=[];
for(let i=1;i<traco.length;i++){
const aLL=traco[i-1],bLL=traco[i];
const aPx=mapa.latLngToContainerPoint([Number(aLL.lat),Number(aLL.lng)]);
const bPx=mapa.latLngToContainerPoint([Number(bLL.lat),Number(bLL.lng)]);
const segM=distanciaMetros(Number(aLL.lat),Number(aLL.lng),Number(bLL.lat),Number(bLL.lng));
segmentos.push({aPx,bPx,segM,base:acumuladoLocal});
acumuladoLocal+=segM;
}

for(const g of candidatos){
const gp=centroVisualPinDesenhoV86(g);
if(!gp) continue;
let melhor=null;
for(const seg of segmentos){
const rr=distanciaPontoSegmentoPixel(gp,seg.aPx,seg.bPx);
if(!melhor || rr.dist<melhor.dist){
melhor={dist:rr.dist,progresso:Number(baseProgresso||0)+seg.base+rr.t*seg.segM};
}
}
if(melhor && melhor.dist<=LIMIAR_CAPTURA_PIN_PX_V86){
capturasDesenhoRota.set(g.id,{progresso:melhor.progresso,distPx:melhor.dist,metodo:'pin_visual_v86'});
atualizarClasseCapturaPinV86(g.id);
}
}
}

// Mantido por compatibilidade com chamadas antigas. Na V8.7 NÃO recalculamos
// capturas antigas a partir do zoom atual: uma vez que o traço cruzou o pin,
// a seleção permanece enquanto o usuário move/zooma o mapa para continuar.
function recomputarCapturasDesenhoV83(){
for(const g of paradasValidasDesenhoV82()) atualizarClasseCapturaPinV86(g.id);
}

function descricaoParadaFaltanteV85(g){
if(ehStopValido(g.stop)) return `Original ${String(g.stop).trim()}`;
const e=String(g.endereco||'').trim();
return e ? e.split(',').slice(0,2).join(',') : 'Extra';
}

function resumoFaltantesDesenhoV85(faltantes){
if(!faltantes || !faltantes.length) return '';
const nomes=faltantes.slice(0,4).map(descricaoParadaFaltanteV85);
const extra=faltantes.length>4?` +${faltantes.length-4}`:'';
return `${nomes.join(' · ')}${extra}`;
}

function atualizarDestaqueFaltantesDesenhoV82(){
const faltantes=modoDesenhoRota?paradasFaltantesDesenhoV82():[];
const ids=new Set(faltantes.map(g=>g.id));
Object.entries(marcadores).forEach(([id,m])=>{
const el=m&&m.getElement?m.getElement():null;
const pin=el?el.querySelector('.pin-mapa'):null;
if(pin) pin.classList.toggle('nao-selecionado-desenho',ids.has(id));
if(m&&typeof m.setZIndexOffset==='function') m.setZIndexOffset(ids.has(id)?600:0);
});
const btn=document.getElementById('btnAplicarDesenhoRota');
if(btn){
const total=paradasValidasDesenhoV82().length;
const faltam=faltantes.length;
const totalM=tracosDesenhoRota.reduce((a,t)=>a+comprimentoTracoMetros(t),0);
const desenhoValido=tracosDesenhoRota.length>0 && totalM>=20;
btn.textContent=faltam?`Aplicar desenho · faltam ${faltam}`:'Aplicar desenho';
btn.disabled=!desenhoValido || faltam>0 || total===0;
}
if(faltantes.length){
console.info('[Copiloto V8.8] Paradas ainda não atravessadas pelo traço:', faltantes.map(g=>({id:g.id,shopee:g.stop,endereco:g.endereco,lat:g.lat,lng:g.lng})));
}
const invisiveis=[...paradasAtivasSemCoordenadaV84(),...paradasAtivasSemMarcadorV87()];
if(modoDesenhoRota && invisiveis.length && !faltantes.length){
const instrucao=document.getElementById('instrucaoDesenhoRota');
if(instrucao) instrucao.textContent=`✅ Todos os pins visíveis foram selecionados. ⚠️ ${invisiveis.length} parada(s) sem ponto utilizável no mapa serão mantidas no final da lista.`;
}
return faltantes;
}

function limparDestaquesCapturaDesenho(){
Object.values(marcadores).forEach(m=>{
const el=m && m.getElement ? m.getElement() : null;
const pin=el ? el.querySelector('.pin-mapa') : null;
if(pin){ pin.classList.remove('capturado-desenho'); pin.classList.remove('nao-selecionado-desenho'); }
});
}

function removerLinhasTracosDesenho(){
if(!mapa) return;
linhasTracosDesenho.forEach(l=>{ if(l && mapa.hasLayer(l)) mapa.removeLayer(l); });
linhasTracosDesenho=[];
if(linhaTracoAtual && mapa.hasLayer(linhaTracoAtual)) mapa.removeLayer(linhaTracoAtual);
linhaTracoAtual=null;
}

function limparDesenhoOtimizacao(manterInstrucao){
tracosDesenhoRota=[];
pontosDesenhoRota=[];
capturasDesenhoRota=new Map();
comprimentoDesenhoPx=0;
ultimoPontoDesenhoPx=null;
desenhandoRota=false;
tracoAtualDesenho=null;
removerLinhasTracosDesenho();
if(linhaDesenhoRota && mapa && mapa.hasLayer(linhaDesenhoRota)) mapa.removeLayer(linhaDesenhoRota);
linhaDesenhoRota=null;
limparDestaquesCapturaDesenho();
const btn=document.getElementById('btnAplicarDesenhoRota');
if(btn) btn.disabled=true;
if(modoDesenhoRota) atualizarDestaqueFaltantesDesenhoV82();
if(!manterInstrucao) atualizarInstrucaoDesenho('Desenho limpo. Comece novamente; sua localização continuará sendo o início real da rota.');
}

function cancelarDesenhoOtimizacao(){
limparDesenhoOtimizacao(true);
encerrarModoDesenhoRota();
atualizarMapa();
mostrarToast('✏️ Edição cancelada. A ordem atual foi mantida.', 'neutro');
}

function encerrarModoDesenhoRota(){
modoDesenhoRota=false;
desenhandoRota=false;
tracoAtualDesenho=null;
const painel=document.getElementById('painelDesenhoRota');
if(painel) painel.classList.remove('aberto');
const botao=document.getElementById('botaoDesenharRotaMapa');
if(botao) botao.classList.remove('ativo');
const mapaEl=document.getElementById('mapa');
if(mapaEl) mapaEl.classList.remove('modo-desenho-rota');
configurarInteracoesMapaDuranteDesenho(true);
limparDestaquesCapturaDesenho();
}

function pontoEventoNoMapa(ev){
const container=mapa && mapa.getContainer ? mapa.getContainer() : null;
if(!container) return null;
const rect=container.getBoundingClientRect();
return L.point(ev.clientX-rect.left, ev.clientY-rect.top);
}

function distanciaPontoSegmentoPixel(p,a,b){
const dx=b.x-a.x, dy=b.y-a.y;
const len2=dx*dx+dy*dy;
if(len2<=0.0001) return {dist:p.distanceTo(a), t:0, q:a};
let t=((p.x-a.x)*dx+(p.y-a.y)*dy)/len2;
t=Math.max(0,Math.min(1,t));
const q=L.point(a.x+t*dx,a.y+t*dy);
return {dist:p.distanceTo(q),t,q};
}

function comprimentoTracoMetros(traco){
let total=0;
for(let i=1;i<(traco||[]).length;i++) total+=distanciaMetros(Number(traco[i-1].lat),Number(traco[i-1].lng),Number(traco[i].lat),Number(traco[i].lng));
return total;
}

function progressoBaseNovoTraco(){
let total=0;
tracosDesenhoRota.forEach((t,i)=>{ total+=comprimentoTracoMetros(t); if(i<tracosDesenhoRota.length-1) total+=25; });
return total + (tracosDesenhoRota.length ? 25 : 0);
}

function tentarCapturarPinsNoSegmentoV81(aPx,bPx,aLL,bLL,progressoAntes,comprimentoSegmentoM){
if(!mapa) return;
for(const g of paradasValidasDesenhoV82()){
if(capturasDesenhoRota.has(g.id)) continue;
const gp=centroVisualPinDesenhoV86(g);
if(!gp) continue;
const r=distanciaPontoSegmentoPixel(gp,aPx,bPx);
if(r.dist<=LIMIAR_CAPTURA_PIN_PX_V86){
capturasDesenhoRota.set(g.id,{progresso:progressoAntes+r.t*comprimentoSegmentoM,distPx:r.dist,metodo:'pin_visual_v86'});
atualizarClasseCapturaPinV86(g.id);
const m=marcadores[g.id];
if(m&&typeof m.setZIndexOffset==='function') m.setZIndexOffset(0);
}
}
}

function instalarEventosDesenhoRota(){
if(eventosDesenhoInstalados || !mapa) return;
const container=mapa.getContainer();
if(!container) return;
eventosDesenhoInstalados=true;

container.addEventListener('pointerdown', ev=>{
if(!modoDesenhoRota || modoInteracaoDesenho!=='desenhar') return;
if(ev.button!==undefined && ev.button!==0 && ev.pointerType!=='touch') return;
ev.preventDefault();ev.stopPropagation();
desenhandoRota=true;
try{container.setPointerCapture(ev.pointerId);}catch(erro){}
const px=pontoEventoNoMapa(ev);if(!px) return;
const ll=mapa.containerPointToLatLng(px);
tracoAtualDesenho=[{lat:ll.lat,lng:ll.lng}];
ultimoPontoDesenhoPx=px;
baseProgressoTracoAtual=progressoBaseNovoTraco();
comprimentoDesenhoPx=baseProgressoTracoAtual;
linhaTracoAtual=L.polyline([[ll.lat,ll.lng]],{color:'#003CBD',weight:5,opacity:.9,interactive:false,lineCap:'round',lineJoin:'round'}).addTo(mapa);
linhasTracosDesenho.push(linhaTracoAtual);
atualizarInstrucaoDesenho('Desenhando… solte o dedo quando quiser. Depois você pode mover o mapa e continuar com outro traço.');
},{passive:false});

container.addEventListener('pointermove', ev=>{
if(!modoDesenhoRota || modoInteracaoDesenho!=='desenhar' || !desenhandoRota || !tracoAtualDesenho) return;
ev.preventDefault();ev.stopPropagation();
const px=pontoEventoNoMapa(ev);if(!px||!ultimoPontoDesenhoPx) return;
const ll=mapa.containerPointToLatLng(px);
const ant=tracoAtualDesenho[tracoAtualDesenho.length-1];
const segPx=ultimoPontoDesenhoPx.distanceTo(px);
if(segPx<3) return;
const segM=distanciaMetros(Number(ant.lat),Number(ant.lng),ll.lat,ll.lng);
const progressoAntes=comprimentoDesenhoPx;
comprimentoDesenhoPx+=segM;
tentarCapturarPinsNoSegmentoV81(ultimoPontoDesenhoPx,px,ant,ll,progressoAntes,segM);
tracoAtualDesenho.push({lat:ll.lat,lng:ll.lng});
ultimoPontoDesenhoPx=px;
if(linhaTracoAtual) linhaTracoAtual.addLatLng([ll.lat,ll.lng]);
},{passive:false});

const finalizar=ev=>{
if(!modoDesenhoRota || !desenhandoRota) return;
if(modoInteracaoDesenho==='desenhar'){ ev.preventDefault();ev.stopPropagation(); }
desenhandoRota=false;
try{container.releasePointerCapture(ev.pointerId);}catch(erro){}
if(tracoAtualDesenho && tracoAtualDesenho.length>=2){
const tracoFinalizado=tracoAtualDesenho.slice();
// Repassa APENAS este traço no mesmo zoom em que ele foi desenhado. Assim
// movimentos rápidos não perdem um pin, mas também não capturamos por perto.
capturarPinsNoTracoV86(tracoFinalizado,baseProgressoTracoAtual);
tracosDesenhoRota.push(tracoFinalizado);
}
tracoAtualDesenho=null;linhaTracoAtual=null;
pontosDesenhoRota=tracosDesenhoRota.flat();
const totalM=tracosDesenhoRota.reduce((a,t)=>a+comprimentoTracoMetros(t),0);
const valido=tracosDesenhoRota.length>0 && totalM>=20;
// As capturas foram validadas pelo círculo visual no zoom de cada traço.
recomputarCapturasDesenhoV83();
const faltantes=atualizarDestaqueFaltantesDesenhoV82();
const totalValidos=paradasValidasDesenhoV82().length;
atualizarInstrucaoDesenho(valido
? (faltantes.length
? `${capturasDesenhoRota.size} de ${totalValidos} paradas selecionadas. ⚠️ Falta: ${resumoFaltantesDesenhoV85(faltantes)}.`
: `✅ Todas as ${totalValidos} paradas foram selecionadas. Você pode aplicar a ordem desenhada.`)
: 'O traço ficou muito curto. Desenhe novamente.');
};
container.addEventListener('pointerup',finalizar,{passive:false});
container.addEventListener('pointercancel',finalizar,{passive:false});
}

function dadosProjecaoNosTracosV81(grupo){
if(!mapa || !tracosDesenhoRota.length) return {progresso:Infinity,distanciaMetros:Infinity,capturado:false};
const captura=capturasDesenhoRota.get(grupo.id);
const gp=mapa.latLngToContainerPoint([Number(grupo.lat),Number(grupo.lng)]);
let acumulado=0,melhor=null;
for(let ti=0;ti<tracosDesenhoRota.length;ti++){
const t=tracosDesenhoRota[ti];
for(let i=1;i<t.length;i++){
const a=mapa.latLngToContainerPoint([t[i-1].lat,t[i-1].lng]);
const b=mapa.latLngToContainerPoint([t[i].lat,t[i].lng]);
const segM=distanciaMetros(Number(t[i-1].lat),Number(t[i-1].lng),Number(t[i].lat),Number(t[i].lng));
const r=distanciaPontoSegmentoPixel(gp,a,b);
if(!melhor || r.dist<melhor.dist){
const q=r.q||a;const ll=mapa.containerPointToLatLng(q);
melhor={dist:r.dist,progresso:acumulado+r.t*segM,lat:ll.lat,lng:ll.lng};
}
acumulado+=segM;
}
if(ti<tracosDesenhoRota.length-1) acumulado+=25;
}
if(!melhor) return {progresso:Infinity,distanciaMetros:Infinity,capturado:false};
const distM=distanciaMetros(Number(grupo.lat),Number(grupo.lng),melhor.lat,melhor.lng);
return {progresso:captura?captura.progresso:melhor.progresso,distanciaMetros:distM,capturado:!!captura};
}

function chaveRuaV81(grupo){
try{
const info=extrairRuaENumero(normalizarTexto(grupo.endereco));
return info && info.rua ? info.rua : '';
}catch(e){ return ''; }
}

function valorCustoMatrizV81(resultado,indices,prev,cand,next){
if(!resultado) return null;
const pi=prev ? indices.get(prev.id) : 0;
const ci=indices.get(cand.id);
const ni=next ? indices.get(next.id) : null;
if(!Number.isInteger(pi)||!Number.isInteger(ci)) return null;
const t1=valorMatriz(resultado.duracoes,pi,ci),d1=valorMatriz(resultado.distancias,pi,ci);
if(!Number.isFinite(t1)||!Number.isFinite(d1)) return null;
let tempo=t1,dist=d1;
if(next && Number.isInteger(ni)){
const t2=valorMatriz(resultado.duracoes,ci,ni),d2=valorMatriz(resultado.distancias,ci,ni);
if(!Number.isFinite(t2)||!Number.isFinite(d2)) return null;
tempo+=t2;dist+=d2;
}
return {tempo,dist};
}

function ordenarBucketV81(bucket,prev,next,resultado,indices,inicio){
const restantes=[...bucket],out=[];let atual=prev;
while(restantes.length){
let best=0,bestScore=Infinity,bestDist=Infinity;
for(let i=0;i<restantes.length;i++){
const c=restantes[i];
let tempo,dist;
if(resultado){
const ai=atual?indices.get(atual.id):0,ci=indices.get(c.id),ni=next?indices.get(next.id):null;
const t=valorMatriz(resultado.duracoes,ai,ci),d=valorMatriz(resultado.distancias,ai,ci);
const tn=next&&Number.isInteger(ni)?valorMatriz(resultado.duracoes,ci,ni):0;
if(Number.isFinite(t)&&Number.isFinite(d)){tempo=t+(Number.isFinite(tn)?tn*.18:0);dist=d;}
}
if(!Number.isFinite(tempo)){
const pa=atual?pontoGrupo(atual):(inicio||pontoGrupo(c));const pc=pontoGrupo(c);
tempo=distanciaPontos(pa,pc)/10;dist=distanciaPontos(pa,pc);
}
if(tempo<bestScore-1 || (Math.abs(tempo-bestScore)<=1 && dist<bestDist)){best=i;bestScore=tempo;bestDist=dist;}
}
const escolhido=restantes.splice(best,1)[0];out.push(escolhido);atual=escolhido;
}
return out;
}

function construirOrdemIntencaoV81(validos,resultado,indices,inicio){
const avaliados=validos.map(g=>({g,...dadosProjecaoNosTracosV81(g)}));
const anchors=avaliados.filter(x=>x.capturado).sort((a,b)=>a.progresso-b.progresso).map(x=>x.g);
if(!anchors.length){
return avaliados.sort((a,b)=>a.progresso-b.progresso||a.distanciaMetros-b.distanciaMetros).map(x=>x.g);
}
const progAnchor=anchors.map(g=>capturasDesenhoRota.get(g.id).progresso);
const buckets=Array.from({length:anchors.length+1},()=>[]);
avaliados.filter(x=>!x.capturado).forEach(x=>{
let gap=0;while(gap<progAnchor.length && x.progresso>progAnchor[gap]) gap++;
buckets[gap].push(x.g);
});
const ordem=[];let prev=null;
for(let gap=0;gap<buckets.length;gap++){
const next=gap<anchors.length?anchors[gap]:null;
const ordenados=ordenarBucketV81(buckets[gap],prev,next,resultado,indices,inicio);
ordem.push(...ordenados);if(ordenados.length) prev=ordenados[ordenados.length-1];
if(next){ordem.push(next);prev=next;}
}
return ordem;
}

function custoSequenciaV81(seq,prev,next,resultado,indices,inicio){
let tempo=0,dist=0;let anterior=prev;
for(const g of seq){
const ai=anterior?indices.get(anterior.id):0,gi=indices.get(g.id);
const t=resultado?valorMatriz(resultado.duracoes,ai,gi):null;
const d=resultado?valorMatriz(resultado.distancias,ai,gi):null;
if(Number.isFinite(t)&&Number.isFinite(d)){tempo+=t;dist+=d;}else{const origem=anterior?pontoGrupo(anterior):(inicio||pontoGrupo(g));const dd=distanciaPontos(origem,pontoGrupo(g));tempo+=dd/10;dist+=dd;}
anterior=g;
}
if(next && seq.length){
const ai=indices.get(seq[seq.length-1].id),ni=indices.get(next.id);
const t=resultado?valorMatriz(resultado.duracoes,ai,ni):null,d=resultado?valorMatriz(resultado.distancias,ai,ni):null;
if(Number.isFinite(t)&&Number.isFinite(d)){tempo+=t;dist+=d;}
}
return {tempo,dist};
}

function permutarV81(arr){
if(arr.length<=1) return [arr.slice()];
const out=[];for(let i=0;i<arr.length;i++){
const resto=arr.slice(0,i).concat(arr.slice(i+1));
for(const p of permutarV81(resto)) out.push([arr[i],...p]);
}
return out;
}

function refinarOrdemPorOrientacaoRuaV81(ordem,resultado,indices,inicio){
const out=[...ordem];let i=0;
while(i<out.length){
const rua=chaveRuaV81(out[i]);if(!rua){i++;continue;}
let j=i+1;while(j<out.length && chaveRuaV81(out[j])===rua) j++;
const tam=j-i;
if(tam>=2){
const bloco=out.slice(i,j),prev=i>0?out[i-1]:null,next=j<out.length?out[j]:null;
let candidatas=[];
if(tam<=6) candidatas=permutarV81(bloco);
else candidatas=[bloco,[...bloco].reverse(),ordenarBucketV81(bloco,prev,next,resultado,indices,inicio)];
let melhor=bloco,mc=custoSequenciaV81(bloco,prev,next,resultado,indices,inicio);
for(const c of candidatas){const cc=custoSequenciaV81(c,prev,next,resultado,indices,inicio);if(cc.tempo<mc.tempo-1 || (Math.abs(cc.tempo-mc.tempo)<=1&&cc.dist<mc.dist)){melhor=c;mc=cc;}}
out.splice(i,tam,...melhor);
}
i=j;
}
return out;
}

function refinarOrdemRuaConservadoraV82(ordem,resultado,indices,inicio){
if(!resultado) return {ordem:[...ordem],ajustes:0};
const out=[...ordem];
let ajustes=0,i=0;
while(i<out.length){
const rua=chaveRuaV81(out[i]);
if(!rua){i++;continue;}
let j=i+1;
while(j<out.length&&chaveRuaV81(out[j])===rua) j++;
const tam=j-i;
if(tam>=2){
const bloco=out.slice(i,j),invertido=[...bloco].reverse();
const prev=i>0?out[i-1]:null,next=j<out.length?out[j]:null;
const atual=custoSequenciaV81(bloco,prev,next,resultado,indices,inicio);
const inv=custoSequenciaV81(invertido,prev,next,resultado,indices,inicio);
const ganhoTempo=atual.tempo-inv.tempo;
const ganhoDist=atual.dist-inv.dist;
const pctTempo=atual.tempo>0?ganhoTempo/atual.tempo:0;
const pctDist=atual.dist>0?ganhoDist/atual.dist:0;
const economiaTempoClara=ganhoTempo>=45&&pctTempo>=0.10&&inv.dist<=atual.dist*1.05;
const economiaDistClara=ganhoDist>=250&&pctDist>=0.15&&inv.tempo<=atual.tempo+10;
if(economiaTempoClara||economiaDistClara){
out.splice(i,tam,...invertido);ajustes++;
}
}
i=j;
}
return {ordem:out,ajustes};
}

function simplificarPontosV81(pontos,maxPontos=1200){
if(!Array.isArray(pontos)||pontos.length<=maxPontos) return (pontos||[]).map(p=>({lat:Number(p.lat),lng:Number(p.lng)}));
const passo=(pontos.length-1)/(maxPontos-1),saida=[];
for(let i=0;i<maxPontos;i++){const p=pontos[Math.round(i*passo)];saida.push({lat:Number(p.lat),lng:Number(p.lng)});}
return saida;
}

async function geometriaRotaPelasRuasV81(ordem,inicio,destino=null){
try{
const pernas=await consultarPernasRotaOSRMV710(ordem,inicio,destino);
const pts=[];
for(const perna of pernas){for(const p of perna||[]){const ult=pts[pts.length-1];if(!ult||Math.abs(ult.lat-p.lat)>1e-7||Math.abs(ult.lng-p.lng)>1e-7) pts.push(p);}}
return simplificarPontosV81(pts,1200);
}catch(e){console.warn('Não foi possível obter a geometria da rota pelas ruas:',e);return null;}
}

async function aplicarDesenhoOtimizacao(){
if(!tracosDesenhoRota.length){mostrarToast('⚠️ Desenhe pelo menos um trecho da rota','alerta');return;}
// V8.7: confirma o conjunto já capturado pelo cruzamento visual exato dos pins.
recomputarCapturasDesenhoV83();
const validos=paradasValidasDesenhoV82();
const invalidos=paradasAtivasSemCoordenadaV84();
const semMarcador=paradasAtivasSemMarcadorV87();
const naoDesenhaveis=[...invalidos,...semMarcador.filter(g=>!invalidos.some(x=>x.id===g.id))];
const faltantes=paradasFaltantesDesenhoV82();
if(faltantes.length){
atualizarDestaqueFaltantesDesenhoV82();
const bounds=faltantes.map(g=>[Number(g.lat),Number(g.lng)]);
if(mapa&&bounds.length){try{mapa.fitBounds(bounds,{padding:[70,70],maxZoom:17});}catch(e){}}
atualizarInstrucaoDesenho(`⚠️ Falta selecionar: ${resumoFaltantesDesenhoV85(faltantes)}. O pin está destacado no mapa.`);
mostrarToast(`⚠️ Falta: ${resumoFaltantesDesenhoV85(faltantes)}`,'alerta');
return;
}
let inicio;
try{
abrirOverlayOtimizacao('Obtendo sua localização para iniciar a rota...');
inicio=await obterPontoInicialOtimizacao();
}catch(e){
fecharOverlayOtimizacao();
const msg=ehDispositivoMovelV82()? '⚠️ Não consegui sua localização. Ative o GPS e tente novamente.' : '⚠️ Não consegui sua localização. Use o ajuste manual para definir sua posição e tente novamente.';
mostrarToast(msg,'alerta');
return;
}
let ordem=validos.slice().sort((a,b)=>(capturasDesenhoRota.get(a.id)?.progresso??Infinity)-(capturasDesenhoRota.get(b.id)?.progresso??Infinity));
let matriz=null,indices=new Map(validos.map((g,i)=>[g.id,i+1]));
try{
atualizarProgressoOtimizacao('Conferindo sentidos das ruas sem alterar seu desenho...');
matriz=await consultarMatrizGlobalOSRM([inicio,...validos.map(pontoGrupo)]);
}catch(e){console.warn('Matriz viária indisponível; mantendo exatamente a ordem desenhada:',e);}
const refinado=refinarOrdemRuaConservadoraV82(ordem,matriz,indices,inicio);
ordem=refinado.ordem;
// Paradas ativas sem pin utilizável não podem ser desenhadas. Na V8.7 elas
// não bloqueiam o motorista nem viram "faltando" fantasma: permanecem no
// final da rota, preservando a ordem original entre si, até terem a localização
// corrigida. Grupos já entregues continuam depois delas.
const idsOrdem=new Set(ordem.map(g=>g.id));
const gruposNaoDesenhaveis=grupos
.filter(g=>paradaParticipaDoDesenhoV84(g)&&!idsOrdem.has(g.id))
.sort((a,b)=>(a.indiceImportacao??0)-(b.indiceImportacao??0));
const gruposJaEntregues=grupos.filter(g=>!paradaParticipaDoDesenhoV84(g));
grupos=[...ordem,...gruposNaoDesenhaveis,...gruposJaEntregues];
grupos.forEach((g,i)=>{g.ordemOtimizada=i+1;});
const ordemIndices=ordem.map(g=>indices.get(g.id));
let metricas={duracao:null,distancia:null};
let metricasShopee={duracao:null,distancia:null};
if(matriz&&ordemIndices.every(Number.isInteger)){
metricas=metricasOrdemNaMatriz(ordemIndices,matriz,null);

// V8.8: compara a rota manual com a ordem original da Shopee usando
// exatamente a mesma origem, os mesmos pontos e a mesma matriz viária.
const ordemShopeeValidos=[...validos].sort((a,b)=>(a.indiceImportacao??0)-(b.indiceImportacao??0));
const ordemShopeeIndices=ordemShopeeValidos.map(g=>indices.get(g.id));
if(ordemShopeeIndices.every(Number.isInteger)){
metricasShopee=metricasOrdemNaMatriz(ordemShopeeIndices,matriz,null);
}

// O tempo de serviço é o mesmo conjunto de paradas nas duas rotas.
// Somamos aos dois totais para a comparação exibida ficar consistente.
const tempoServicoTotal=ordem.reduce((acc,g)=>acc+tempoServicoGrupoSegundos(g),0);
if(Number.isFinite(metricas.duracao)) metricas.duracao+=tempoServicoTotal;
if(Number.isFinite(metricasShopee.duracao)) metricasShopee.duracao+=tempoServicoTotal;
}
atualizarProgressoOtimizacao('Encaixando sua ordem nas ruas...');
const geometria=await geometriaRotaPelasRuasV81(ordem,inicio);
metaRota={
modo:'desenho',provedor:matriz?'OSRM_GLOBAL':'DESENHO_DIRETO',criterio:'ordem_manual_fiel_v8_8',
distanciaMetros:metricas.distancia,duracaoSegundos:metricas.duracao,
distanciaShopeeMetros:metricasShopee.distancia,duracaoShopeeSegundos:metricasShopee.duracao,destinoFinal:null,
inicioRota:{lat:Number(inicio.lat),lng:Number(inicio.lng)},ultimaParada:ordem.length?ordem[ordem.length-1].id:null,
geometriaRota:geometria||null,paradasCapturadas:capturasDesenhoRota.size,paradasLongeDoTraco:0,ajustesOrientacaoRua:refinado.ajustes,
organizacaoPacotesConcluida:false,atualizadoEm:Date.now()
};
grupos.forEach(g=>g.pacotes.forEach(p=>p.organizadoCarro=false));
limparDesenhoOtimizacao(true);
encerrarModoDesenhoRota();
mapaFoiEnquadrado=true;
salvarStorage();
fecharOverlayOtimizacao();
renderizarTudo();
if(naoDesenhaveis.length){
mostrarToast(`⚠️ Rota aplicada. ${naoDesenhaveis.length} parada(s) sem ponto utilizável ficaram no final da lista.`,'alerta');
}else if(refinado.ajustes>0) mostrarToast(`✅ Rota aplicada. ${refinado.ajustes} trecho(s) da mesma rua foram invertidos por ganho claro.`,'sucesso');
else if(geometria) mostrarToast('✅ Sua ordem foi aplicada e encaixada nas ruas','sucesso');
else mostrarToast('✅ Sua ordem foi aplicada. O caminho viário não pôde ser desenhado agora.','alerta');
}

function restaurarOrdemShopee(){
if(!grupos.length) return;
grupos.sort((a,b)=>(a.indiceImportacao??0)-(b.indiceImportacao??0));
grupos.forEach(g=>{g.ordemOtimizada=null;/* organização física preservada */});
metaRota={modo:'shopee',provedor:null,distanciaMetros:null,duracaoSegundos:null,distanciaShopeeMetros:null,duracaoShopeeSegundos:null,destinoFinal:null,organizacaoPacotesConcluida:false,atualizadoEm:Date.now()};
modoOrganizacaoPacotes=false;
removerLinhaRotaGpsV81();
salvarStorage();
renderizarTudo();
mostrarToast('Ordem original restaurada', 'neutro');
}

function removerMarcadoresInicioFimDesenho(){
if(marcadorInicioDesenho && mapa && mapa.hasLayer(marcadorInicioDesenho)) mapa.removeLayer(marcadorInicioDesenho);
if(marcadorFimDesenho && mapa && mapa.hasLayer(marcadorFimDesenho)) mapa.removeLayer(marcadorFimDesenho);
marcadorInicioDesenho=null;marcadorFimDesenho=null;
}

function removerLinhaRotaGpsV81(){
if(linhaRotaGps && mapa && mapa.hasLayer(linhaRotaGps)) mapa.removeLayer(linhaRotaGps);
if(linhaRotaGpsContorno && mapa && mapa.hasLayer(linhaRotaGpsContorno)) mapa.removeLayer(linhaRotaGpsContorno);
linhaRotaGps=null;
linhaRotaGpsContorno=null;
if(linhaDesenhoSalva && mapa && mapa.hasLayer(linhaDesenhoSalva)) mapa.removeLayer(linhaDesenhoSalva);
linhaDesenhoSalva=null;
removerMarcadoresInicioFimDesenho();
}

function atualizarLinhaRotaManualNoMapa(){
if(!mapa) return;
removerLinhaRotaGpsV81();
if(modoDesenhoRota) return;
if(!metaRota || !['desenho','auto_v9'].includes(metaRota.modo) || !Array.isArray(metaRota.geometriaRota) || metaRota.geometriaRota.length<2) return;
const latlngs=metaRota.geometriaRota.filter(p=>Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))).map(p=>[Number(p.lat),Number(p.lng)]);
if(latlngs.length<2) return;
linhaRotaGpsContorno=L.polyline(latlngs,{color:'#ffffff',weight:9,opacity:.94,interactive:false,lineCap:'round',lineJoin:'round',className:'rota-gps-contorno'}).addTo(mapa);
linhaRotaGps=L.polyline(latlngs,{color:'#003CBD',weight:5.5,opacity:.96,interactive:false,lineCap:'round',lineJoin:'round',className:'rota-gps-linha'}).addTo(mapa);
const ultima=[...grupos].reverse().find(g=>g.pacotes.some(p=>p.status==='pendente'));
if(ultima && Number.isFinite(Number(ultima.lat))&&Number.isFinite(Number(ultima.lng))){
const icFim=L.divIcon({html:'<div class="pin-fim-desenho">'+iconeLinha('flag')+'</div>',className:'',iconSize:[30,30],iconAnchor:[15,15]});
marcadorFimDesenho=L.marker([Number(ultima.lat),Number(ultima.lng)],{icon:icFim,zIndexOffset:850,interactive:false}).addTo(mapa);
}
}

// ----------------------------------------------------------------------
// V8.3 - ORGANIZAÇÃO DOS PACOTES NO CARRO (ORDEM INVERSA)
// ----------------------------------------------------------------------
function organizacaoPacotesDisponivel(){
return !!(grupos.length && metaRota && ['desenho','auto_v9'].includes(metaRota.modo) && !metaRota.organizacaoPacotesConcluida);
}

function abrirOrganizacaoPacotes(){
if(!organizacaoPacotesDisponivel()) return;
modoOrganizacaoPacotes=true;
irParaAba(1);
definirSheetListaMapa(true);
renderizarOrganizacaoPacotes();
atualizarVisibilidadeOrganizacaoPacotes();
// O botão fica acima da Parada 1; ao abrir, sempre começamos pelo topo
// da organização (última entrega / primeiro pacote a entrar no carro).
requestAnimationFrame(()=>requestAnimationFrame(()=>{
try{window.scrollTo({top:0,left:0,behavior:'auto'});}catch(e){window.scrollTo(0,0);}
document.documentElement.scrollTop=0;
document.body.scrollTop=0;
const conteudoSheet=document.querySelector('.sheet-lista-conteudo'); if(conteudoSheet) conteudoSheet.scrollTop=0;
}));
}

function fecharOrganizacaoPacotes(){
modoOrganizacaoPacotes=false;
atualizarVisibilidadeOrganizacaoPacotes();
atualizarStatusOtimizacaoRota();
}

function atualizarVisibilidadeOrganizacaoPacotes(){
const painel=document.getElementById('painelOrganizacaoPacotes');
const lista=document.getElementById('lista');
const btn=document.getElementById('btnOrganizarPacotes');
if(painel) painel.style.display=modoOrganizacaoPacotes?'block':'none';
if(lista) lista.style.display=modoOrganizacaoPacotes?'none':'block';
if(btn&&modoOrganizacaoPacotes) btn.style.display='none';
if(modoOrganizacaoPacotes) renderizarOrganizacaoPacotes();
}

function renderizarOrganizacaoPacotes(){
const container=document.getElementById('listaOrganizacaoPacotes');
if(!container) return;
const reversa=[...grupos].reverse();
let html='';
for(const g of reversa){
const pendentes=g.pacotes.map((p,idx)=>({p,idx})).filter(x=>!x.p.organizadoCarro);
if(!pendentes.length) continue;
let linhas='';
for(const item of pendentes){
const p=item.p,idx=item.idx;
const shopee=String(p.stop||g.stopOriginal||g.stop||'Extra');
const rota=temOrdemOtimizada(g)?g.ordemOtimizada:'—';
linhas+=`<div class="organizar-pacote">
<div class="organizar-pacote-info">
<div class="organizar-pacote-codigo">${iconeLinha('package')} ${escaparHtmlTexto(p.codigo)}</div>
<div class="organizar-pacote-meta">Original: ${escaparHtmlTexto(shopee)} · Rota: ${rota}</div>
<div class="organizar-pacote-endereco">${escaparHtmlTexto(p.endereco)}</div>
</div>
<button class="organizar-pacote-acao" onclick="marcarPacoteOrganizadoV82('${g.id}',${idx})">${iconeLinha('check')} Pacote no carro</button>
</div>`;
}
html+=`<div class="organizar-parada"><div class="organizar-parada-cab">${iconeLinha('pin')} Entrega ${temOrdemOtimizada(g)?g.ordemOtimizada:'—'}<small>Original: ${escaparHtmlTexto(g.stopOriginal||g.stop||'Extra')} · ${pendentes.length} pacote(s) restante(s)</small></div>${linhas}</div>`;
}
container.innerHTML=html||'<div class="aviso-vazio">Todos os pacotes já foram organizados</div>';
const todos=grupos.flatMap(g=>g.pacotes),feitos=todos.filter(p=>p.organizadoCarro).length,total=todos.length;
const pct=total?Math.round(feitos/total*100):0;
const barra=document.getElementById('barraOrganizarPacotes');if(barra) barra.style.width=pct+'%';
const txt=document.getElementById('textoProgressoOrganizar');if(txt) txt.textContent=`${feitos} de ${total} pacote(s) organizados · ${pct}%`;
}

function marcarPacoteOrganizadoV82(grupoId,indice){
const g=encontrarGrupo(grupoId);if(!g||!g.pacotes[indice]) return;
g.pacotes[indice].organizadoCarro=true;
const todos=grupos.flatMap(x=>x.pacotes);
const concluiu=todos.length>0&&todos.every(p=>p.organizadoCarro);
if(concluiu){
metaRota.organizacaoPacotesConcluida=true;
modoOrganizacaoPacotes=false;
salvarStorage();
renderizarTudo();
mostrarToast('✅ Carro organizado! A lista voltou para a ordem normal de entrega.','sucesso');
return;
}
salvarStorage();
renderizarOrganizacaoPacotes();
}


// ======================================================================
// V9.1 - CONFIGURAÇÃO PRINCIPAL DO MOTOR
// ======================================================================

function carregarConfiguracaoV9(){
try{
const bruto=localStorage.getItem(CONFIG_OTIMIZACAO_V9_KEY);
const cfg=bruto?JSON.parse(bruto):null;
if(!cfg||!['padrao','destino','nenhuma'].includes(cfg.modo)) return {modo:'padrao',destinoFinal:null};
return {modo:cfg.modo,destinoFinal:pontoValido(cfg.destinoFinal)?cfg.destinoFinal:null};
}catch(erro){
return {modo:'padrao',destinoFinal:null};
}
}

function salvarConfiguracaoV9(modo,destinoFinal=null){
const modoSeguro=modo==='destino'?'destino':(modo==='nenhuma'?'nenhuma':'padrao');
const cfg={modo:modoSeguro,destinoFinal:modoSeguro==='destino'&&pontoValido(destinoFinal)?destinoFinal:null};
try{localStorage.setItem(CONFIG_OTIMIZACAO_V9_KEY,JSON.stringify(cfg));}catch(erro){}
atualizarResumoConfiguracaoV9();
return cfg;
}

function textoDestinoCurtoV9(destino){
if(!pontoValido(destino)) return 'nenhum destino selecionado';
return destino.nome||destino.endereco||destino.texto||`${Number(destino.lat).toFixed(4)}, ${Number(destino.lng).toFixed(4)}`;
}

function atualizarResumoConfiguracaoV9(){
const cfg=carregarConfiguracaoV9();
const resumo=document.getElementById('resumoModoOtimizacaoV9');
const atual=document.getElementById('textoConfigAtualV9');
const opPadrao=document.getElementById('opcaoV9Padrao');
const opDestino=document.getElementById('opcaoV9Destino');
const opNenhuma=document.getElementById('opcaoV9Nenhuma');
const textoResumo=cfg.modo==='nenhuma'
? 'Não otimizar'
: (cfg.modo==='destino'&&pontoValido(cfg.destinoFinal)
? `Terminar próximo: ${textoDestinoCurtoV9(cfg.destinoFinal)}`
: 'Scanner por regiões');
if(resumo) resumo.textContent=textoResumo;
if(atual){
if(cfg.modo==='nenhuma') atual.innerHTML=`<strong>Configuração atual:</strong> ${iconeLinha('list')} Não otimizar · manter ordem original`;
else if(cfg.modo==='destino'&&pontoValido(cfg.destinoFinal)) atual.innerHTML=`<strong>Configuração atual:</strong> ${iconeLinha('flag')} Terminar próximo de ${escaparHtmlTexto(textoDestinoCurtoV9(cfg.destinoFinal))}`;
else atual.innerHTML=`<strong>Configuração atual:</strong> ${iconeLinha('route')} Scanner por regiões`;
}
if(opPadrao) opPadrao.classList.toggle('selecionada',cfg.modo==='padrao');
if(opDestino) opDestino.classList.toggle('selecionada',cfg.modo==='destino');
if(opNenhuma) opNenhuma.classList.toggle('selecionada',cfg.modo==='nenhuma');
atualizarResumoSettingsV10();
}

function abrirConfiguracaoV9(){
atualizarResumoConfiguracaoV9();
const modal=document.getElementById('modalConfigOtimizacaoV9');
if(modal) modal.classList.add('aberto');
}

function fecharConfiguracaoV9(){
const modal=document.getElementById('modalConfigOtimizacaoV9');
if(modal) modal.classList.remove('aberto');
}

function selecionarConfiguracaoV9Padrao(){
salvarConfiguracaoV9('padrao',null);
fecharConfiguracaoV9();
mostrarToast('Configuração de rota atualizada','sucesso');
}

function selecionarConfiguracaoV9Destino(){
fecharConfiguracaoV9();
const cfg=carregarConfiguracaoV9();
destinoSelecionadoAtual=pontoValido(cfg.destinoFinal)?{...cfg.destinoFinal}:null;
abrirSeletorDestinoFinal();
}

function selecionarConfiguracaoV9Nenhuma(){
salvarConfiguracaoV9('nenhuma',null);
fecharConfiguracaoV9();
mostrarToast('Configuração salva: manter a ordem original','sucesso');
}

async function buscarEnderecoDestinoV9(){
const campo=document.getElementById('buscaEnderecoDestinoV9');
const consulta=(campo&&campo.value||'').trim();
if(!consulta){mostrarToast('⚠️ Digite um endereço para pesquisar','alerta');return;}
try{
mostrarToast('🔍 Procurando endereço...','neutro');
const resultado=await geocodificarEndereco(consulta);
if(!resultado){mostrarToast('⚠️ Endereço não encontrado','alerta');return;}
const ponto={lat:Number(resultado.lat),lng:Number(resultado.lng),endereco:consulta,texto:consulta};
await definirDestinoSelecionado(ponto,false);
if(mapaDestinoFinal) mapaDestinoFinal.setView([ponto.lat,ponto.lng],17);
}catch(erro){
mostrarToast('⚠️ Não foi possível pesquisar este endereço','alerta');
}
}

function confirmarDestinoSelecionadoV9(){
if(!pontoValido(destinoSelecionadoAtual)){mostrarToast('⚠️ Escolha um ponto no mapa ou pesquise um endereço','alerta');return;}
const nome=(document.getElementById('nomeDestinoSalvo')?.value||'').trim();
const destino={...destinoSelecionadoAtual};
if(nome){destino.nome=nome;destino.texto=nome;}
else if(!destino.texto) destino.texto=destino.endereco||'Ponto escolhido no mapa';
salvarConfiguracaoV9('destino',destino);
fecharSeletorDestinoFinal();
mostrarToast('🏁 Destino final salvo na configuração','sucesso');
}

function usarDestinoSalvoV9(id){
const item=carregarDestinosSalvos().find(x=>String(x.id)===String(id));
if(!item) return;
destinoSelecionadoAtual={...item,texto:item.nome||item.endereco||'Local salvo'};
salvarConfiguracaoV9('destino',destinoSelecionadoAtual);
fecharSeletorDestinoFinal();
mostrarToast(`🏁 ${item.nome||'Destino'} selecionado`,'sucesso');
}

async function executarOtimizacaoPrincipalV9(){
const cfg=carregarConfiguracaoV9();
if(cfg.modo==='nenhuma') return;
if(cfg.modo==='destino'){
if(!pontoValido(cfg.destinoFinal)){
mostrarToast('🏁 Escolha primeiro onde deseja terminar','alerta');
abrirSeletorDestinoFinal();
return;
}
return otimizarRotaAutomaticamenteV9(cfg.destinoFinal);
}
return otimizarRotaAutomaticamenteV9(null);
}

// ======================================================================
// V9.1 - MOTOR AUTOMÁTICO REALISTA (PRINCIPAL)
// ======================================================================
/*
Princípios da V9:
1) A ordem original é sempre a baseline e nunca pode ser substituída por uma
   alternativa pior em tempo. Em empate técnico (até 15 s), vence menor km.
2) O custo usa matriz DIRECIONAL de tempo + distância pelas ruas (OSRM).
   A -> B e B -> A podem ter custos diferentes por mão única/retornos/acessos.
3) Gera múltiplas sementes: Shopee, vizinho mais rápido, vizinho com leve
   preferência por km, inserção de menor custo e várias primeiras paradas.
4) Refina globalmente com realocação, troca, inversão e blocos, sem janelas
   fixas de 10 paradas.
5) Pós-processa situações de "passei no caminho e deixei para depois": se
   inserir uma entrega entre A e B custa quase nada (<=20s e <=180m), ela é
   puxada para aquele ponto e a rota é refinada novamente.
6) Até 90 paradas usa busca mais profunda; acima disso reduz iterações para
   manter o celular responsivo.
*/

const V9_EPS_TEMPO_SEG = 15;

function metricasIndicesV9(ordem, resultado){
let anterior=0,tempo=0,distancia=0;
for(const idx of ordem){
const t=valorMatriz(resultado.duracoes,anterior,idx);
const d=valorMatriz(resultado.distancias,anterior,idx);
if(!Number.isFinite(t)||!Number.isFinite(d)) return {tempo:Infinity,distancia:Infinity};
tempo+=t;distancia+=d;anterior=idx;
}
// V9.1: quando existe um destino final configurado, ele é um ponto fixo da
// matriz. Assim o motor favorece uma última entrega que já deixe o motorista
// próximo desse destino, sem transformar o destino em uma entrega.
const fim = Number.isInteger(resultado && resultado.indiceDestinoFinalV9) ? resultado.indiceDestinoFinalV9 : null;
if(fim !== null && ordem.length){
const t=valorMatriz(resultado.duracoes,anterior,fim);
const d=valorMatriz(resultado.distancias,anterior,fim);
if(!Number.isFinite(t)||!Number.isFinite(d)) return {tempo:Infinity,distancia:Infinity};
tempo+=t;distancia+=d;
}
return {tempo,distancia};
}

function avaliacaoMelhorV9(a,b){
if(!b) return true;
if(a.tempo < b.tempo - V9_EPS_TEMPO_SEG) return true;
if(b.tempo < a.tempo - V9_EPS_TEMPO_SEG) return false;
return a.distancia < b.distancia - 1;
}

function sementeVizinhoV9(indices,resultado,primeiroForcado=null,pesoKm=0){
const restantes=new Set(indices),saida=[];
let atual=0;
if(Number.isInteger(primeiroForcado)&&restantes.has(primeiroForcado)){
saida.push(primeiroForcado);restantes.delete(primeiroForcado);atual=primeiroForcado;
}
while(restantes.size){
let melhor=null,melhorCusto=Infinity;
for(const candidato of restantes){
const t=valorMatriz(resultado.duracoes,atual,candidato);
const d=valorMatriz(resultado.distancias,atual,candidato);
const custo=t+pesoKm*(d/1000);
if(custo<melhorCusto){melhorCusto=custo;melhor=candidato;}
}
if(melhor===null) break;
saida.push(melhor);restantes.delete(melhor);atual=melhor;
}
return saida;
}

function sementeInsercaoV9(indices,resultado,primeiroForcado=null){
const restantes=new Set(indices);
let rota=[];
if(Number.isInteger(primeiroForcado)&&restantes.has(primeiroForcado)){
rota=[primeiroForcado];restantes.delete(primeiroForcado);
}else{
let primeiro=null,melhor=Infinity;
for(const x of restantes){const t=valorMatriz(resultado.duracoes,0,x);if(t<melhor){melhor=t;primeiro=x;}}
if(primeiro===null) return [];
rota=[primeiro];restantes.delete(primeiro);
}
while(restantes.size){
let melhorInsercao=null;
for(const x of restantes){
for(let pos=0;pos<=rota.length;pos++){
const cand=[...rota.slice(0,pos),x,...rota.slice(pos)];
const m=metricasIndicesV9(cand,resultado);
if(!melhorInsercao||avaliacaoMelhorV9(m,melhorInsercao.metricas)) melhorInsercao={x,pos,metricas:m};
}
}
if(!melhorInsercao) break;
rota.splice(melhorInsercao.pos,0,melhorInsercao.x);restantes.delete(melhorInsercao.x);
}
return rota;
}

function melhorMovimentoV9(rota,resultado,tipo,tamanhoBloco=1){
const atual=metricasIndicesV9(rota,resultado),n=rota.length;
let melhor=null;
const testar=cand=>{const m=metricasIndicesV9(cand,resultado);if(avaliacaoMelhorV9(m,atual)&&(!melhor||avaliacaoMelhorV9(m,melhor.metricas))) melhor={rota:cand,metricas:m};};
if(tipo==='relocar'){
for(let i=0;i<n;i++){
const x=rota[i],base=[...rota.slice(0,i),...rota.slice(i+1)];
for(let j=0;j<n;j++){if(j===i) continue;testar([...base.slice(0,j),x,...base.slice(j)]);}
}
}else if(tipo==='trocar'){
for(let i=0;i<n-1;i++) for(let j=i+1;j<n;j++){const c=[...rota];[c[i],c[j]]=[c[j],c[i]];testar(c);}
}else if(tipo==='inverter'){
for(let i=0;i<n-1;i++) for(let j=i+1;j<n;j++) testar([...rota.slice(0,i),...rota.slice(i,j+1).reverse(),...rota.slice(j+1)]);
}else if(tipo==='bloco'){
const L=tamanhoBloco;
for(let i=0;i<=n-L;i++){
const bloco=rota.slice(i,i+L),base=[...rota.slice(0,i),...rota.slice(i+L)];
for(let j=0;j<=base.length;j++){if(j===i) continue;testar([...base.slice(0,j),...bloco,...base.slice(j)]);}
}
}
return melhor;
}

function melhorRealocacaoRapidaV9(rota,resultado,metricasAtuais){
const n=rota.length;
let melhor=null;
const fim = Number.isInteger(resultado && resultado.indiceDestinoFinalV9) ? resultado.indiceDestinoFinalV9 : null;
function aresta(a,b){
if(b===null||b===undefined) return {tempo:0,distancia:0};
return {tempo:valorMatriz(resultado.duracoes,a,b),distancia:valorMatriz(resultado.distancias,a,b)};
}
for(let i=0;i<n;i++){
const x=rota[i];
const pred=i===0?0:rota[i-1];
const prox=i<n-1?rota[i+1]:fim;
const ePredX=aresta(pred,x),eXProx=aresta(x,prox),ePredProx=aresta(pred,prox);
if(!Number.isFinite(ePredX.tempo)||!Number.isFinite(ePredX.distancia)) continue;
if(prox!==null && (!Number.isFinite(eXProx.tempo)||!Number.isFinite(ePredProx.tempo))) continue;
const base=[...rota.slice(0,i),...rota.slice(i+1)];
const deltaRemT=(prox!==null?ePredProx.tempo:0)-ePredX.tempo-(prox!==null?eXProx.tempo:0);
const deltaRemD=(prox!==null?ePredProx.distancia:0)-ePredX.distancia-(prox!==null?eXProx.distancia:0);
for(let j=0;j<=base.length;j++){
if(j===i) continue;
const p=j===0?0:base[j-1];
const q=j<base.length?base[j]:fim;
const ePX=aresta(p,x),eXQ=aresta(x,q),ePQ=aresta(p,q);
if(!Number.isFinite(ePX.tempo)||!Number.isFinite(ePX.distancia)) continue;
if(q!==null && (!Number.isFinite(eXQ.tempo)||!Number.isFinite(ePQ.tempo))) continue;
const deltaInsT=ePX.tempo+(q!==null?eXQ.tempo:0)-(q!==null?ePQ.tempo:0);
const deltaInsD=ePX.distancia+(q!==null?eXQ.distancia:0)-(q!==null?ePQ.distancia:0);
const m={tempo:metricasAtuais.tempo+deltaRemT+deltaInsT,distancia:metricasAtuais.distancia+deltaRemD+deltaInsD};
if(avaliacaoMelhorV9(m,metricasAtuais)&&(!melhor||avaliacaoMelhorV9(m,melhor.metricas))){
melhor={rota:[...base.slice(0,j),x,...base.slice(j)],metricas:m};
}
}
}
return melhor;
}

function refinarGlobalV9(rota,resultado,rodadas=3){
let atual=[...rota],met=metricasIndicesV9(atual,resultado);
for(let r=0;r<rodadas;r++){
let mudou=false;
// Realocação é o movimento mais importante para entregas e agora usa delta
// de arestas O(n²), permitindo busca global sem congelar o celular.
for(let k=0;k<Math.min(6,atual.length);k++){
const mov=melhorRealocacaoRapidaV9(atual,resultado,met);
if(!mov) break;
atual=mov.rota;met=mov.metricas;mudou=true;
}
for(const tipo of ['trocar','inverter']){
const mov=melhorMovimentoV9(atual,resultado,tipo,1);
if(mov&&avaliacaoMelhorV9(mov.metricas,met)){atual=mov.rota;met=mov.metricas;mudou=true;}
}
if(!mudou) break;
}
return {ordem:atual,metricas:met};
}

function corrigirPassouPertoV9(rota,resultado){
let r=[...rota],mudou=true,ciclos=0;
while(mudou&&ciclos++<3){
mudou=false;
externo: for(let i=0;i<r.length-1;i++){
const anterior=i===0?0:r[i-1],atual=r[i];
const tDireto=valorMatriz(resultado.duracoes,anterior,atual);
const dDireto=valorMatriz(resultado.distancias,anterior,atual);
if(!Number.isFinite(tDireto)||!Number.isFinite(dDireto)) continue;
for(let j=i+1;j<r.length;j++){
const x=r[j];
const extraT=valorMatriz(resultado.duracoes,anterior,x)+valorMatriz(resultado.duracoes,x,atual)-tDireto;
const extraD=valorMatriz(resultado.distancias,anterior,x)+valorMatriz(resultado.distancias,x,atual)-dDireto;
if(extraT<=20&&extraD<=180){r.splice(j,1);r.splice(i,0,x);mudou=true;break externo;}
}
}
}
return r;
}

async function motorAutomaticoV9(indices,resultado,baseline){
const sementes=[];
sementes.push([...baseline]);
sementes.push(sementeVizinhoV9(indices,resultado));
sementes.push(sementeVizinhoV9(indices,resultado,null,1.5));
sementes.push(sementeInsercaoV9(indices,resultado));
const proximos=[...indices].sort((a,b)=>valorMatriz(resultado.duracoes,0,a)-valorMatriz(resultado.duracoes,0,b)).slice(0,Math.min(indices.length,indices.length<=90?4:3));
const distantes=[...indices].sort((a,b)=>valorMatriz(resultado.duracoes,0,b)-valorMatriz(resultado.duracoes,0,a)).slice(0,Math.min(indices.length,1));
for(const primeiro of [...proximos,...distantes]){
sementes.push(sementeVizinhoV9(indices,resultado,primeiro));
}
const unicas=[],vistos=new Set();
for(const s of sementes){const k=s.join(',');if(s.length===indices.length&&!vistos.has(k)){vistos.add(k);unicas.push(s);}}
let melhor={ordem:[...baseline],metricas:metricasIndicesV9(baseline,resultado)};
const ranqueadas=unicas
.map(ordem=>({ordem,metricas:metricasIndicesV9(ordem,resultado)}))
.sort((a,b)=>{
if(avaliacaoMelhorV9(a.metricas,b.metricas)) return -1;
if(avaliacaoMelhorV9(b.metricas,a.metricas)) return 1;
return 0;
});
const limiteRefino=indices.length<=90?4:3;
const finalistas=ranqueadas.slice(0,limiteRefino);
// A baseline também merece uma chance de melhoria mesmo quando não ficou
// entre as sementes brutas mais promissoras.
if(!finalistas.some(x=>x.ordem.join(',')===baseline.join(','))){
finalistas.push({ordem:[...baseline],metricas:metricasIndicesV9(baseline,resultado)});
}
const rodadas=indices.length<=90?3:2;
for(let i=0;i<finalistas.length;i++){
atualizarProgressoOtimizacao(`Refinando melhores candidatas... ${i+1}/${finalistas.length}`);
let refinada=refinarGlobalV9(finalistas[i].ordem,resultado,rodadas);
let passou=corrigirPassouPertoV9(refinada.ordem,resultado);
refinada=refinarGlobalV9(passou,resultado,1);
if(avaliacaoMelhorV9(refinada.metricas,melhor.metricas)) melhor=refinada;
if(i<finalistas.length-1) await esperar(0);
}
return melhor;
}

async function otimizarRotaAutomaticamenteV9(destinoFinal=null){
if(!grupos.length){mostrarToast('⚠️ Importe uma rota primeiro','alerta');return;}
const ativos=grupos.filter(g=>paradaParticipaDoDesenhoV84(g)&&paradaTemCoordenadaValidaV84(g));
const semCoordenada=grupos.filter(g=>paradaParticipaDoDesenhoV84(g)&&!paradaTemCoordenadaValidaV84(g));
const entregues=grupos.filter(g=>!paradaParticipaDoDesenhoV84(g));
if(ativos.length<2){mostrarToast('⚠️ Não há paradas suficientes para otimizar','alerta');return;}
const destino = pontoValido(destinoFinal) ? {
lat:Number(destinoFinal.lat),
lng:Number(destinoFinal.lng),
nome:destinoFinal.nome||'',
endereco:destinoFinal.endereco||'',
texto:destinoFinal.texto||destinoFinal.nome||destinoFinal.endereco||'Destino final'
} : null;
let inicio;
try{
abrirOverlayOtimizacao(destino?'Obtendo sua localização e preparando o destino final...':'Obtendo sua localização atual...');
inicio=await obterPontoInicialOtimizacao();
atualizarProgressoOtimizacao(destino?'Montando matriz das ruas com o destino final...':'Montando matriz direcional das ruas...');
const pontos=[inicio,...ativos.map(pontoGrupo),...(destino?[destino]:[])];
const matriz=await consultarMatrizGlobalOSRM(pontos);
matriz.indiceDestinoFinalV9 = destino ? pontos.length-1 : null;
const porId=new Map(ativos.map((g,i)=>[g.id,i+1]));
const baselineGrupos=[...ativos].sort((a,b)=>(a.indiceImportacao??0)-(b.indiceImportacao??0));
const baselineIndices=baselineGrupos.map(g=>porId.get(g.id));
const indices=ativos.map(g=>porId.get(g.id));
const resultado=await motorAutomaticoV9(indices,matriz,baselineIndices);
const gruposPorIndice=new Map(ativos.map((g,i)=>[i+1,g]));
const ordemGrupos=resultado.ordem.map(i=>gruposPorIndice.get(i)).filter(Boolean);
const baselineMet=metricasIndicesV9(baselineIndices,matriz);
const diferencaTempoV9 = resultado.metricas.tempo - baselineMet.tempo;
const melhorou = diferencaTempoV9 < -1 || (Math.abs(diferencaTempoV9) <= 1 && resultado.metricas.distancia < baselineMet.distancia - 1);
const ordemFinal=melhorou?ordemGrupos:baselineGrupos;
const metFinal=melhorou?resultado.metricas:baselineMet;
const tempoServico=ordemFinal.reduce((acc,g)=>acc+tempoServicoGrupoSegundos(g),0);
const metricasFinal={duracao:metFinal.tempo+tempoServico,distancia:metFinal.distancia};
const metricasShopee={duracao:baselineMet.tempo+tempoServico,distancia:baselineMet.distancia};
const naoRoteaveis=[...semCoordenada].sort((a,b)=>(a.indiceImportacao??0)-(b.indiceImportacao??0));
grupos=[...ordemFinal,...naoRoteaveis,...entregues];
grupos.forEach((g,i)=>{g.ordemOtimizada=i+1;(g.pacotes||[]).forEach(p=>p.organizadoCarro=false);});
atualizarProgressoOtimizacao('Desenhando a rota vencedora pelas ruas...');
const geometria=await geometriaRotaPelasRuasV81(ordemFinal,inicio,destino);
metaRota={
modo:'auto_v9',provedor:'OSRM_GLOBAL',criterio:destino?'v9_tempo_primeiro_km_desempate_destino_final':'v9_tempo_primeiro_km_desempate',resultadoOtimizacao:melhorou?'v9_automatica':'shopee_mantida',
distanciaMetros:metricasFinal.distancia,duracaoSegundos:metricasFinal.duracao,
distanciaShopeeMetros:metricasShopee.distancia,duracaoShopeeSegundos:metricasShopee.duracao,
destinoFinal:destino,inicioRota:{lat:Number(inicio.lat),lng:Number(inicio.lng)},ultimaParada:ordemFinal.length?ordemFinal[ordemFinal.length-1].id:null,
geometriaRota:geometria||null,paradasAnalisadas:ativos.length,organizacaoPacotesConcluida:false,atualizadoEm:Date.now()
};
modoOrganizacaoPacotes=false;mapaFoiEnquadrado=true;salvarStorage();fecharOverlayOtimizacao();renderizarTudo();
if(melhorou){
mostrarToast(destino?'Rota otimizada terminando próximo ao destino':'Rota otimizada com sucesso','sucesso');
}else{
mostrarToast(destino?'✅ Melhor referência mantida respeitando o destino final':'✅ A ordem original já estava muito boa — mantida','neutro');
}
if(semCoordenada.length) setTimeout(()=>mostrarToast(`⚠️ ${semCoordenada.length} parada(s) sem coordenada ficaram no final da lista`,'alerta'),500);
}catch(erro){
console.error('Falha na otimização V9:',erro);fecharOverlayOtimizacao();mostrarToast('⚠️ Não consegui calcular a matriz das ruas. A ordem atual foi mantida.','alerta');
}
}

// ======================================================================
// V7.5 - PERFIL EXPERIMENTAL DE OTIMIZAÇÃO OPERACIONAL
// ======================================================================
/*
PROMPT EXPERIMENTAL SALVO — se o teste piorar a rota, voltar ao motor V7.4
sem misturar estas regras:

1) Janelas de Tempo Hard (restrição obrigatória): ETA deve ser <= horário
   limite; sequências que estouram o prazo são descartadas.
2) Agrupamento Geográfico (otimização primária): dividir endereços em
   micro-regiões antes de ordenar o tráfego, evitando abandonar a região/rua
   e voltar depois.
3) Janelas de Tempo Soft (otimização secundária): preferência de horário gera
   penalidade virtual, mas não quebra a rota se isso destruir o restante.
4) Tempo de Serviço: Casa = +2 min; Prédio/Condomínio = +7 min, salvo valor
   explícito na planilha.
5) Custos de Deslocamento: matriz direcional de tempo + distância pelas vias.

Hierarquia efetiva do teste:
HARD > MICRO-REGIÃO > RUA > SOFT > TEMPO DE SERVIÇO > TEMPO+KM PELAS VIAS.
*/
// Estratégia V7.5:
// 1) monta a matriz DIRECIONAL global de todas as paradas;
// 2) cria micro-regiões geográficas adaptativas (sem tamanho fixo de 10);
// 3) dentro de cada micro-região, trata cada rua como um bloco contínuo;
// 4) janelas hard podem quebrar clustering/rua porque são obrigatórias;
// 5) janelas soft apenas penalizam uma sequência;
// 6) ETAs e tempo total incluem tempo de serviço estimado em cada parada;
// 7) escolhe uma única rota pelo equilíbrio 50% tempo + 50% quilômetros.
// As alternativas analisadas ficam internas e não poluem a interface.

function carregarPreferenciaOtimizacao(){
try{
const bruto = localStorage.getItem(OTIMIZACAO_PREF_KEY);
const pref = bruto ? JSON.parse(bruto) : null;
if(!pref || !['rapida','endereco'].includes(pref.modo)){
return {lembrar:false, modo:'rapida', destinoFinal:null};
}
return {
lembrar:!!pref.lembrar,
modo:pref.modo,
destinoFinal:pontoValido(pref.destinoFinal) ? pref.destinoFinal : null
};
}catch(erro){
return {lembrar:false, modo:'rapida', destinoFinal:null};
}
}

function salvarPreferenciaOtimizacao(modo, destinoFinal, lembrar){
try{
localStorage.setItem(OTIMIZACAO_PREF_KEY, JSON.stringify({
lembrar:!!lembrar,
modo:['rapida','endereco'].includes(modo) ? modo : 'rapida',
destinoFinal:pontoValido(destinoFinal) ? destinoFinal : null
}));
}catch(erro){
console.warn('Não foi possível salvar a preferência de otimização:', erro);
}
}

function carregarDestinosSalvos(){
try{
let bruto = localStorage.getItem(DESTINOS_SALVOS_KEY);

// Migra automaticamente locais salvos na V7.1 para a chave estável nova.
if(!bruto){
const legado = localStorage.getItem(DESTINOS_SALVOS_LEGADO_KEY);
if(legado){
bruto = legado;
localStorage.setItem(DESTINOS_SALVOS_KEY, legado);
}
}

const itens = bruto ? JSON.parse(bruto) : [];
return Array.isArray(itens) ? itens.filter(pontoValido) : [];
}catch(erro){
return [];
}
}

function persistirDestinosSalvos(lista){
try{
localStorage.setItem(DESTINOS_SALVOS_KEY, JSON.stringify(lista));
}catch(erro){
mostrarToast('⚠️ Não foi possível salvar este local no aparelho', 'alerta');
}
}

function escaparHtmlTexto(valor){
return String(valor ?? '')
.replace(/&/g,'&amp;')
.replace(/</g,'&lt;')
.replace(/>/g,'&gt;')
.replace(/"/g,'&quot;')
.replace(/'/g,'&#039;');
}

function abrirModalOtimizacao(modoConfiguracao){
modalOtimizacaoEmModoConfiguracao = !!modoConfiguracao;
const modal = document.getElementById('modalOtimizacao');
const fechar = document.getElementById('fecharModalOtimizacaoBtn');
const pref = carregarPreferenciaOtimizacao();
const lembrar = document.getElementById('lembrarEscolhaOtimizacao');

if(lembrar) lembrar.checked = !!pref.lembrar;
if(fechar) fechar.classList.toggle('visivel', !!modoConfiguracao);
modal.classList.add('aberto');
}

function fecharModalOtimizacao(){
document.getElementById('modalOtimizacao').classList.remove('aberto');
modalOtimizacaoEmModoConfiguracao = false;
}

function abrirConfiguracaoOtimizacao(){
abrirModalOtimizacao(true);
}

function primeiraEscolhaOtimizacaoConcluida(){
try{
return localStorage.getItem(OTIMIZACAO_PRIMEIRA_ESCOLHA_KEY) === 'true';
}catch(erro){
return false;
}
}

function registrarPrimeiraEscolhaOtimizacao(){
try{
localStorage.setItem(OTIMIZACAO_PRIMEIRA_ESCOLHA_KEY, 'true');
}catch(erro){
console.warn('Não foi possível registrar a primeira configuração de otimização:', erro);
}
}

function prepararOtimizacaoAposImportacao(){
const pref = carregarPreferenciaOtimizacao();

// Na primeira rota desta versão, SEMPRE mostramos a escolha pelo menos uma
// vez. Isso evita que uma configuração antiga ou feita fora da rota pule a
// etapa de onboarding sem o usuário entender como o Copiloto vai organizar.
if(!primeiraEscolhaOtimizacaoConcluida()){
abrirModalOtimizacao(false);
return;
}

if(pref.lembrar && pref.modo === 'rapida'){
executarEscolhaOtimizacao('rapida', null, true);
return;
}

if(pref.lembrar && pref.modo === 'endereco' && pontoValido(pref.destinoFinal)){
executarEscolhaOtimizacao('endereco', pref.destinoFinal, true);
return;
}

// Se a pessoa não pediu para lembrar, mostramos a escolha em toda nova rota.
abrirModalOtimizacao(false);
}

function selecionarModoOtimizacao(modo){
if(modo === 'endereco'){
abrirSeletorDestinoFinal();
return;
}
const lembrar = !!document.getElementById('lembrarEscolhaOtimizacao').checked;
executarEscolhaOtimizacao('rapida', null, lembrar);
}

function executarEscolhaOtimizacao(modo, destinoFinal, lembrar){
if(modo === 'endereco' && !pontoValido(destinoFinal)){
abrirSeletorDestinoFinal();
return;
}

// Sem uma rota carregada, o botão funciona somente como configuração para
// a próxima importação. No modo destino, a coordenada pingada também é salva
// na preferência quando "Lembrar minha escolha" estiver marcado.
if(!grupos.length){
salvarPreferenciaOtimizacao(modo, destinoFinal, lembrar);
fecharSeletorDestinoFinal();
fecharModalOtimizacao();
mostrarToast('⚙️ Preferência de otimização salva', 'sucesso');
return;
}

salvarPreferenciaOtimizacao(modo, destinoFinal, lembrar);
registrarPrimeiraEscolhaOtimizacao();
fecharSeletorDestinoFinal();
fecharModalOtimizacao();
executarOtimizacaoRota(modo, destinoFinal);
}

function renderizarDestinosSalvos(){
const area = document.getElementById('areaDestinosSalvos');
const listaEl = document.getElementById('listaDestinosSalvos');
if(!area || !listaEl) return;

const salvos = carregarDestinosSalvos();
area.style.display = salvos.length ? 'block' : 'none';
listaEl.innerHTML = salvos.map(item=>{
const nome = escaparHtmlTexto(item.nome || 'Local salvo');
const endereco = escaparHtmlTexto(item.endereco || `${Number(item.lat).toFixed(5)}, ${Number(item.lng).toFixed(5)}`);
return `
<div class="destino-salvo-card">
<div class="nome">${iconeLinha('pin')} ${nome}</div>
<div class="endereco">${endereco}</div>
<div class="destino-salvo-acoes">
<button class="destino-salvo-usar" onclick="usarDestinoSalvoV9('${item.id}')">Usar</button>
<button class="destino-salvo-excluir" onclick="removerDestinoSalvo('${item.id}')">Excluir</button>
</div>
</div>`;
}).join('');
}

// V10.6 - uma única cartografia clara, sem troca de estilo por zoom.
// O tratamento visual fica apenas na camada base, preservando pins e rota.
// Tiles nativos até 19; no zoom 20, amplia-se somente o último nível.
function adicionarMapaBaseLimpoV102(mapaAlvo, avisarFallback=false){
const caminho='/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
let erros=0;
let servidorAlternativo=false;
let avisoExibido=false;
let trocaPendente=null;
const base=L.tileLayer('https://server.arcgisonline.com'+caminho,{
  minZoom:0,
  maxNativeZoom:19,
  maxZoom:20,
  keepBuffer:3,
  updateWhenZooming:false,
  className:'copiloto-base-clara',
  attribution:'Tiles &copy; <a href="https://www.esri.com/">Esri</a>'
});
base.on('loading',()=>{erros=0;});
base.on('tileerror',()=>{
  erros++;
  if(erros<4) return;
  if(!servidorAlternativo){
    servidorAlternativo=true;
    // Outro endereço do MESMO serviço: mantém cartografia, filtro e zoom.
    // Adia a recarga até o Leaflet terminar de processar o tile com erro.
    trocaPendente=setTimeout(()=>{
      trocaPendente=null;
      if(mapaAlvo.hasLayer(base)){
        base.setUrl('https://services.arcgisonline.com'+caminho);
      }
    },0);
  }else if(avisarFallback && !avisoExibido && trocaPendente===null){
    avisoExibido=true;
    mostrarToast('Não foi possível carregar parte do mapa. Verifique sua conexão.','neutro');
  }
});
mapaAlvo.on('unload',()=>{
  if(trocaPendente!==null) clearTimeout(trocaPendente);
});
mapaAlvo.setMaxZoom(20);
base.addTo(mapaAlvo);
return {base};
}
function inicializarMapaDestinoFinal(){
if(mapaDestinoFinal) return;

mapaDestinoFinal = L.map('mapaDestinoFinal', {
zoomControl:true,
attributionControl:true
}).setView([-14.235,-51.925], 4);

adicionarMapaBaseLimpoV102(mapaDestinoFinal,false);

mapaDestinoFinal.on('click', function(e){
definirDestinoSelecionado({lat:e.latlng.lat, lng:e.latlng.lng}, true);
});
}

function enquadrarMapaDestinoFinal(){
if(!mapaDestinoFinal) return;

if(ultimaPosicaoUsuario && pontoValido(ultimaPosicaoUsuario)){
mapaDestinoFinal.setView([Number(ultimaPosicaoUsuario.lat), Number(ultimaPosicaoUsuario.lng)], 14);
return;
}

const pontos = gruposComCoordenadaValida().map(g=>[Number(g.lat), Number(g.lng)]);
if(pontos.length){
mapaDestinoFinal.fitBounds(pontos, {padding:[28,28], maxZoom:14});
}
}

function abrirSeletorDestinoFinal(){
const modal = document.getElementById('modalDestinoFinal');
if(!modal) return;
renderizarDestinosSalvos();
modal.classList.add('aberto');
setTimeout(()=>{
inicializarMapaDestinoFinal();
mapaDestinoFinal.invalidateSize();
if(pontoValido(destinoSelecionadoAtual)){
definirDestinoSelecionado(destinoSelecionadoAtual,false);
mapaDestinoFinal.setView([Number(destinoSelecionadoAtual.lat),Number(destinoSelecionadoAtual.lng)],16);
}else{
enquadrarMapaDestinoFinal();
}
}, 120);
}

function fecharSeletorDestinoFinal(){
const modal = document.getElementById('modalDestinoFinal');
if(modal) modal.classList.remove('aberto');
}

async function reverseGeocodificarPonto(lat, lng){
try{
const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
const resposta = await fetch(url, {headers:{'Accept-Language':'pt-BR'}});
if(!resposta.ok) return null;
const dados = await resposta.json();
return dados && dados.display_name ? dados.display_name : null;
}catch(erro){
console.warn('Não foi possível identificar o endereço do ponto:', erro);
return null;
}
}

async function definirDestinoSelecionado(ponto, buscarEndereco){
if(!pontoValido(ponto)) return;
const lat = Number(ponto.lat);
const lng = Number(ponto.lng);

destinoSelecionadoAtual = {
lat,
lng,
nome:ponto.nome || '',
endereco:ponto.endereco || '',
texto:ponto.texto || ponto.nome || ponto.endereco || 'Ponto escolhido no mapa'
};

if(marcadorDestinoSelecionado){
marcadorDestinoSelecionado.setLatLng([lat,lng]);
}else if(mapaDestinoFinal){
const icone = L.divIcon({
html:'<div class="pin-destino-final">'+iconeLinha('flag')+'</div>',
className:'',
iconSize:[30,30],
iconAnchor:[15,15]
});
marcadorDestinoSelecionado = L.marker([lat,lng], {icon:icone, zIndexOffset:1000}).addTo(mapaDestinoFinal);
}

const info = document.getElementById('destinoSelecionadoInfo');
if(info) info.innerHTML = iconeLinha('flag') + '<span>Ponto selecionado. Identificando o endereço...</span>'; 

if(buscarEndereco){
const endereco = await reverseGeocodificarPonto(lat,lng);
if(destinoSelecionadoAtual && Number(destinoSelecionadoAtual.lat) === lat && Number(destinoSelecionadoAtual.lng) === lng){
destinoSelecionadoAtual.endereco = endereco || '';
destinoSelecionadoAtual.texto = destinoSelecionadoAtual.nome || endereco || 'Ponto escolhido no mapa';
}
}

if(info && destinoSelecionadoAtual){
info.innerHTML = iconeLinha('flag') + '<span>' + escaparHtmlTexto(destinoSelecionadoAtual.endereco ? destinoSelecionadoAtual.endereco : `Ponto escolhido: ${lat.toFixed(5)}, ${lng.toFixed(5)}`) + '</span>'; 
}
}

function confirmarDestinoSelecionado(){
if(!pontoValido(destinoSelecionadoAtual)){
mostrarToast('⚠️ Toque no mapa para escolher onde deseja terminar', 'alerta');
return;
}
const lembrar = !!document.getElementById('lembrarEscolhaOtimizacao').checked;
const nome = (document.getElementById('nomeDestinoSalvo').value || '').trim();
const destino = {...destinoSelecionadoAtual};
if(nome){
destino.nome = nome;
destino.texto = nome;
}else if(!destino.texto){
destino.texto = destino.endereco || 'Ponto escolhido no mapa';
}
executarEscolhaOtimizacao('endereco', destino, lembrar);
}

function salvarDestinoSelecionado(){
if(!pontoValido(destinoSelecionadoAtual)){
mostrarToast('⚠️ Primeiro toque no mapa para escolher um ponto', 'alerta');
return;
}

const input = document.getElementById('nomeDestinoSalvo');
const nome = (input.value || '').trim();
if(!nome){
mostrarToast('⚠️ Dê um nome para este local, como Casa ou Base', 'alerta');
input.focus();
return;
}

const lista = carregarDestinosSalvos();
const item = {
id:'dest_' + Date.now(),
nome,
lat:Number(destinoSelecionadoAtual.lat),
lng:Number(destinoSelecionadoAtual.lng),
endereco:destinoSelecionadoAtual.endereco || '',
texto:nome
};
lista.push(item);
persistirDestinosSalvos(lista.slice(-20));
destinoSelecionadoAtual = {...item};
renderizarDestinosSalvos();
mostrarToast(`💾 ${nome} salvo`, 'sucesso');
}

function usarDestinoSalvo(id){
const item = carregarDestinosSalvos().find(x=>String(x.id) === String(id));
if(!item) return;
destinoSelecionadoAtual = {...item, texto:item.nome || item.endereco || 'Local salvo'};
const lembrar = !!document.getElementById('lembrarEscolhaOtimizacao').checked;
executarEscolhaOtimizacao('endereco', destinoSelecionadoAtual, lembrar);
}

function removerDestinoSalvo(id){
const lista = carregarDestinosSalvos().filter(x=>String(x.id) !== String(id));
persistirDestinosSalvos(lista);
renderizarDestinosSalvos();
mostrarToast('🗑️ Local salvo removido', 'neutro');
}

function abrirOverlayOtimizacao(texto){
const overlay = document.getElementById('overlayOtimizando');
const el = document.getElementById('textoProgressoOtimizacao');
if(el && texto) el.textContent = texto;
if(overlay) overlay.classList.add('aberto');
}

function atualizarProgressoOtimizacao(texto){
const el = document.getElementById('textoProgressoOtimizacao');
if(el) el.textContent = texto;
}

function fecharOverlayOtimizacao(){
const overlay = document.getElementById('overlayOtimizando');
if(overlay) overlay.classList.remove('aberto');
}

function pontoGrupo(grupo){
return {lat:parseFloat(grupo.lat), lng:parseFloat(grupo.lng), grupo};
}

function pontoValido(p){
return p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng));
}

function distanciaPontos(a,b){
return distanciaMetros(Number(a.lat), Number(a.lng), Number(b.lat), Number(b.lng));
}

function gruposComCoordenadaValida(){
return grupos.filter(g => {
const p = pontoGrupo(g);
return pontoValido(p);
});
}

async function obterPontoInicialOtimizacao(){
// No PC, se o usuário já ajustou a posição manualmente, essa é a fonte mais
// confiável. No celular, tentamos sempre uma leitura GPS nova.
if(localizacaoManualAtiva && meuMarcador){
const ll = meuMarcador.getLatLng();
return {lat:ll.lat, lng:ll.lng, precisao:0, manual:true};
}

if(navigator.geolocation && geolocalizacaoPodeFuncionarAqui()){
try{
const posicao = await new Promise((resolve,reject)=>{
navigator.geolocation.getCurrentPosition(resolve, reject, {
enableHighAccuracy:true,
maximumAge:0,
timeout:20000
});
});
aplicarPosicaoGeolocalizada(posicao, false);
return {
lat:posicao.coords.latitude,
lng:posicao.coords.longitude,
precisao:posicao.coords.accuracy,
manual:false
};
}catch(erro){
console.warn('GPS novo não disponível para otimização:', erro);
}
}

if(ultimaPosicaoUsuario && pontoValido(ultimaPosicaoUsuario)){
return {
lat:ultimaPosicaoUsuario.lat,
lng:ultimaPosicaoUsuario.lng,
precisao:ultimaPosicaoUsuario.precisao,
manual:false
};
}

throw new Error('LOCALIZACAO_INDISPONIVEL');
}

function rotaVizinhoMaisProximo(gruposEntrada, inicio){
const restantes = [...gruposEntrada];
const ordem = [];
let atual = inicio;

while(restantes.length){
let melhorIndice = 0;
let melhorDistancia = Infinity;
for(let i=0;i<restantes.length;i++){
const d = distanciaPontos(atual, pontoGrupo(restantes[i]));
if(d < melhorDistancia){
melhorDistancia = d;
melhorIndice = i;
}
}
const proximo = restantes.splice(melhorIndice,1)[0];
ordem.push(proximo);
atual = pontoGrupo(proximo);
}

return ordem;
}

function rotaVizinhoMaisProximoComPrimeiro(gruposEntrada, inicio, primeiro){
if(!primeiro) return rotaVizinhoMaisProximo(gruposEntrada, inicio);
const restantes = gruposEntrada.filter(g => g !== primeiro);
const ordem = [primeiro];
let atual = pontoGrupo(primeiro);

while(restantes.length){
let melhorIndice = 0;
let melhorDistancia = Infinity;
for(let i=0;i<restantes.length;i++){
const d = distanciaPontos(atual, pontoGrupo(restantes[i]));
if(d < melhorDistancia){
melhorDistancia = d;
melhorIndice = i;
}
}
const proximo = restantes.splice(melhorIndice,1)[0];
ordem.push(proximo);
atual = pontoGrupo(proximo);
}

return ordem;
}

function rotaInsercaoComDestino(gruposEntrada, inicio, destino){
// Cheapest insertion com início/fim fixos. É uma das candidatas quando existe
// ponto final escolhido; depois ela ainda será medida pelas vias reais.
const restantes = [...gruposEntrada];
const caminho = [inicio, destino];

while(restantes.length){
let melhor = null;

for(let r=0;r<restantes.length;r++){
const ponto = pontoGrupo(restantes[r]);
for(let pos=0;pos<caminho.length-1;pos++){
const a = caminho[pos];
const b = caminho[pos+1];
const aumento = distanciaPontos(a,ponto) + distanciaPontos(ponto,b) - distanciaPontos(a,b);
if(!melhor || aumento < melhor.aumento){
melhor = {r,pos,aumento};
}
}
}

const escolhido = restantes.splice(melhor.r,1)[0];
caminho.splice(melhor.pos+1,0,pontoGrupo(escolhido));
}

return caminho.slice(1,-1).map(p=>p.grupo);
}

function melhorarRota2Opt(rota, inicio, destino){
// Pré-refino geométrico barato. A decisão final nunca depende só dele: a rota
// depois é medida/refinada pelas vias direcionais do roteador.
if(rota.length < 4) return [...rota];

const inicioVirtual = {lat:Number(inicio.lat), lng:Number(inicio.lng), virtual:true};
const fimVirtual = destino ? {lat:Number(destino.lat), lng:Number(destino.lng), virtual:true} : null;
let nos = [inicioVirtual, ...rota.map(pontoGrupo)];
if(fimVirtual) nos.push(fimVirtual);

const fimEditavel = fimVirtual ? nos.length - 2 : nos.length - 1;
let melhorou = true;
let passadas = 0;

while(melhorou && passadas < 3){
melhorou = false;
passadas++;

for(let i=1;i<fimEditavel;i++){
for(let j=i+1;j<=fimEditavel;j++){
const anterior = nos[i-1];
const primeiro = nos[i];
const ultimo = nos[j];
const seguinte = nos[j+1] || null;

let atual = distanciaPontos(anterior,primeiro);
let novo = distanciaPontos(anterior,ultimo);
if(seguinte){
atual += distanciaPontos(ultimo,seguinte);
novo += distanciaPontos(primeiro,seguinte);
}

if(novo + 1 < atual){
const invertido = nos.slice(i,j+1).reverse();
nos.splice(i,j-i+1,...invertido);
melhorou = true;
}
}
}
}

return nos.filter(n=>!n.virtual).map(n=>n.grupo);
}

function centroGeografico(gruposEntrada){
if(!gruposEntrada.length) return {lat:0,lng:0};
let lat = 0;
let lng = 0;
gruposEntrada.forEach(g=>{
lat += Number(g.lat);
lng += Number(g.lng);
});
return {lat:lat/gruposEntrada.length, lng:lng/gruposEntrada.length};
}

function rotacionarSequenciaParaInicio(seq, inicio, destino){
if(seq.length <= 1) return [...seq];
let melhor = [...seq];
let melhorCusto = Infinity;

for(let i=0;i<seq.length;i++){
const rot = [...seq.slice(i), ...seq.slice(0,i)];
let custo = distanciaPontos(inicio, pontoGrupo(rot[0]));
if(destino) custo += distanciaPontos(pontoGrupo(rot[rot.length-1]), destino);
if(custo < melhorCusto){
melhorCusto = custo;
melhor = rot;
}
}
return melhor;
}

function rotaVarreduraAngular(gruposEntrada, inicio, destino, sentido){
const centro = centroGeografico(gruposEntrada);
const ordenada = [...gruposEntrada].sort((a,b)=>{
const aa = Math.atan2(Number(a.lat)-centro.lat, Number(a.lng)-centro.lng);
const ab = Math.atan2(Number(b.lat)-centro.lat, Number(b.lng)-centro.lng);
return sentido >= 0 ? aa-ab : ab-aa;
});
return rotacionarSequenciaParaInicio(ordenada, inicio, destino);
}

function assinaturaOrdem(ordem){
return ordem.map(g=>String(g.id)).join('>');
}

function gerarCandidatasIniciais(validos, ordemShopee, inicio, destino){
const candidatas = [];
const vistas = new Set();

function adicionar(nome, ordem, aplicar2Opt){
if(!ordem || ordem.length !== validos.length) return;
const final = aplicar2Opt ? melhorarRota2Opt(ordem, inicio, destino) : [...ordem];
const assinatura = assinaturaOrdem(final);
if(vistas.has(assinatura)) return;
vistas.add(assinatura);
candidatas.push({nome, ordem:final});
}

// A ordem original entra como candidata real. Assim a otimização nunca escolhe
// conscientemente algo pior nos DOIS critérios quando a rota original já estiver boa.
adicionar('shopee', ordemShopee, false);
adicionar('vizinho', rotaVizinhoMaisProximo(validos, inicio), true);

if(destino){
adicionar('insercao-destino', rotaInsercaoComDestino(validos, inicio, destino), true);
}

adicionar('varredura-horaria', rotaVarreduraAngular(validos, inicio, destino, 1), true);
adicionar('varredura-antihoraria', rotaVarreduraAngular(validos, inicio, destino, -1), true);
adicionar('shopee-invertida', [...ordemShopee].reverse(), true);

// Variações de início ajudam a escapar do problema clássico do vizinho mais
// próximo: uma primeira escolha aparentemente boa pode obrigar uma volta ruim
// várias paradas depois.
const primeiros = [...validos]
.sort((a,b)=>distanciaPontos(inicio,pontoGrupo(a))-distanciaPontos(inicio,pontoGrupo(b)))
.slice(0,3);

primeiros.forEach((primeiro,indice)=>{
adicionar(`multi-inicio-${indice+1}`, rotaVizinhoMaisProximoComPrimeiro(validos, inicio, primeiro), true);
});

// Limita o custo de rede em rotas grandes sem perder diversidade suficiente.
return candidatas.slice(0,8);
}

function stringCoordenadas(pontos){
return pontos.map(p => `${Number(p.lng).toFixed(6)},${Number(p.lat).toFixed(6)}`).join(';');
}

function matrizDistanciaGeografica(pontos){
return pontos.map((a,i)=>pontos.map((b,j)=>{
if(i === j) return 0;
return distanciaPontos(a,b);
}));
}

async function consultarMatrizOSRM(pontos){
const coords = stringCoordenadas(pontos);
const url = `https://router.project-osrm.org/table/v1/driving/${coords}?annotations=duration,distance`;
const resposta = await fetch(url,{signal:AbortSignal.timeout(25000)});
if(!resposta.ok) throw new Error('OSRM_MATRIX_' + resposta.status);
const dados = await resposta.json();
if(!dados || !Array.isArray(dados.durations)) throw new Error('OSRM_MATRIX_INVALIDA');

// Alguns servidores podem não devolver "distances" mesmo aceitando a tabela.
// Nesse caso mantemos o tempo viário direcional e usamos distância geográfica
// só como fallback do segundo critério local.
const distancias = Array.isArray(dados.distances)
? dados.distances
: matrizDistanciaGeografica(pontos);

return {
duracoes:dados.durations,
distancias,
provedor:'OSRM'
};
}

async function consultarMatrizRoteamento(pontos){
return await consultarMatrizOSRM(pontos);
}

function valoresFinitosMatriz(matriz){
const valores = [];
(matriz || []).forEach((linha,i)=>{
(linha || []).forEach((v,j)=>{
if(i !== j && Number.isFinite(v) && v > 0) valores.push(v);
});
});
return valores;
}

function mediana(valores){
if(!valores.length) return 1;
const ordenados = [...valores].sort((a,b)=>a-b);
const meio = Math.floor(ordenados.length/2);
return ordenados.length % 2
? ordenados[meio]
: (ordenados[meio-1] + ordenados[meio]) / 2;
}

function normalizadoresMatriz(resultado){
return {
tempo:Math.max(1, mediana(valoresFinitosMatriz(resultado.duracoes))),
distancia:Math.max(1, mediana(valoresFinitosMatriz(resultado.distancias)))
};
}

function valorMatriz(matriz, origem, destino){
const valor = matriz && matriz[origem] ? matriz[origem][destino] : null;
return Number.isFinite(valor) ? valor : Infinity;
}

function custoMatrizEquilibrado(resultado, origem, destino, norm){
const tempo = valorMatriz(resultado.duracoes, origem, destino);
const distancia = valorMatriz(resultado.distancias, origem, destino);
if(!Number.isFinite(tempo) || !Number.isFinite(distancia)) return Infinity;

// V7.7: tempo é o objetivo dominante. Distância continua importante, mas
// entra como critério secundário para reduzir combustível sem sacrificar
// significativamente a velocidade da rota.
return 0.90 * (tempo / norm.tempo) + 0.10 * (distancia / norm.distancia);
}

// Consulta a matriz GLOBAL em blocos técnicos. Os blocos existem apenas para
// respeitar o tamanho das requisições HTTP do roteador; a otimização recebe
// no fim UMA matriz única contendo TODAS as paradas da rota.
async function consultarMatrizGlobalOSRM(pontos){
const total = pontos.length;
const duracoes = Array.from({length:total},()=>Array(total).fill(Infinity));
const distancias = Array.from({length:total},()=>Array(total).fill(Infinity));
for(let i=0;i<total;i++){
duracoes[i][i] = 0;
distancias[i][i] = 0;
}

// 40 origens + 40 destinos = no máximo 80 coordenadas por chamada.
// Isso mantém folga para servidores OSRM que limitam o tamanho da tabela.
const TAMANHO_BLOCO = 40;
const blocos = Math.ceil(total / TAMANHO_BLOCO);
let concluido = 0;
const totalConsultas = blocos * blocos;

for(let inicioOrigem=0; inicioOrigem<total; inicioOrigem+=TAMANHO_BLOCO){
const indicesOrigem = [];
for(let i=inicioOrigem;i<Math.min(total,inicioOrigem+TAMANHO_BLOCO);i++) indicesOrigem.push(i);

for(let inicioDestino=0; inicioDestino<total; inicioDestino+=TAMANHO_BLOCO){
const indicesDestino = [];
for(let j=inicioDestino;j<Math.min(total,inicioDestino+TAMANHO_BLOCO);j++) indicesDestino.push(j);

const coords = [
...indicesOrigem.map(i=>pontos[i]),
...indicesDestino.map(i=>pontos[i])
];

const fontes = indicesOrigem.map((_,i)=>i).join(';');
const deslocamentoDestino = indicesOrigem.length;
const destinos = indicesDestino.map((_,i)=>deslocamentoDestino+i).join(';');
const url = `https://router.project-osrm.org/table/v1/driving/${stringCoordenadas(coords)}?sources=${fontes}&destinations=${destinos}&annotations=duration,distance`;

let dados = null;
let ultimoErro = null;
for(let tentativa=0; tentativa<2 && !dados; tentativa++){
try{
const resposta = await fetch(url,{signal:AbortSignal.timeout(25000)});
if(!resposta.ok) throw new Error('OSRM_MATRIX_GLOBAL_' + resposta.status);
const recebido = await resposta.json();
if(!recebido || !Array.isArray(recebido.durations)) throw new Error('OSRM_MATRIX_GLOBAL_INVALIDA');
dados = recebido;
}catch(erro){
ultimoErro = erro;
if(tentativa === 0) await esperar(450);
}
}
if(!dados) throw ultimoErro || new Error('OSRM_MATRIX_GLOBAL_FALHOU');

for(let a=0;a<indicesOrigem.length;a++){
for(let b=0;b<indicesDestino.length;b++){
const oi = indicesOrigem[a];
const dj = indicesDestino[b];
const t = dados.durations && dados.durations[a] ? dados.durations[a][b] : null;
const d = dados.distances && dados.distances[a] ? dados.distances[a][b] : null;
if(Number.isFinite(t)) duracoes[oi][dj] = t;
if(Number.isFinite(d)) distancias[oi][dj] = d;
else if(Number.isFinite(t)) distancias[oi][dj] = distanciaPontos(pontos[oi], pontos[dj]);
}
}

concluido++;
const percentual = Math.round((concluido/Math.max(1,totalConsultas))*100);
atualizarProgressoOtimizacao(`Lendo todas as vias da rota... ${percentual}%`);
if(concluido < totalConsultas) await esperar(180);
}
}

return {duracoes, distancias, provedor:'OSRM_GLOBAL'};
}

function metricasOrdemNaMatriz(ordemIndices, resultado, indiceDestinoFinal){
let duracao = 0;
let distancia = 0;
let anterior = 0; // índice 0 = ponto inicial

for(const atual of ordemIndices){
const t = valorMatriz(resultado.duracoes, anterior, atual);
const d = valorMatriz(resultado.distancias, anterior, atual);
if(!Number.isFinite(t) || !Number.isFinite(d)) return {duracao:null,distancia:null,provedor:null};
duracao += t;
distancia += d;
anterior = atual;
}

if(Number.isInteger(indiceDestinoFinal)){
const t = valorMatriz(resultado.duracoes, anterior, indiceDestinoFinal);
const d = valorMatriz(resultado.distancias, anterior, indiceDestinoFinal);
if(!Number.isFinite(t) || !Number.isFinite(d)) return {duracao:null,distancia:null,provedor:null};
duracao += t;
distancia += d;
}

return {duracao, distancia, provedor:'OSRM_GLOBAL'};
}

function custoOrdemGlobal(ordemIndices, resultado, norm, indiceDestinoFinal){
let custo = 0;
let anterior = 0;
for(const atual of ordemIndices){
const c = custoMatrizEquilibrado(resultado, anterior, atual, norm);
if(!Number.isFinite(c)) return Infinity;
custo += c;
anterior = atual;
}
if(Number.isInteger(indiceDestinoFinal)){
const c = custoMatrizEquilibrado(resultado, anterior, indiceDestinoFinal, norm);
if(!Number.isFinite(c)) return Infinity;
custo += c;
}
return custo;
}

function rotaVizinhoGlobalMatriz(indicesParadas, resultado, norm, primeiroForcado){
const restantes = new Set(indicesParadas);
const ordem = [];
let atual = 0;

if(Number.isInteger(primeiroForcado) && restantes.has(primeiroForcado)){
ordem.push(primeiroForcado);
restantes.delete(primeiroForcado);
atual = primeiroForcado;
}

while(restantes.size){
let melhor = null;
let melhorCusto = Infinity;
for(const candidato of restantes){
const custo = custoMatrizEquilibrado(resultado, atual, candidato, norm);
if(custo < melhorCusto){
melhorCusto = custo;
melhor = candidato;
}
}
if(melhor === null) break;
ordem.push(melhor);
restantes.delete(melhor);
atual = melhor;
}
return ordem;
}

function rotaInsercaoGlobalMatriz(indicesParadas, resultado, norm, indiceDestinoFinal){
const restantes = new Set(indicesParadas);
const rota = [];

while(restantes.size){
let melhor = null;

for(const candidato of restantes){
for(let pos=0;pos<=rota.length;pos++){
const anterior = pos === 0 ? 0 : rota[pos-1];
const seguinte = pos < rota.length ? rota[pos] : (Number.isInteger(indiceDestinoFinal) ? indiceDestinoFinal : null);

let custoAntigo = 0;
if(seguinte !== null) custoAntigo = custoMatrizEquilibrado(resultado, anterior, seguinte, norm);
let custoNovo = custoMatrizEquilibrado(resultado, anterior, candidato, norm);
if(seguinte !== null) custoNovo += custoMatrizEquilibrado(resultado, candidato, seguinte, norm);
const delta = custoNovo - custoAntigo;

if(Number.isFinite(delta) && (!melhor || delta < melhor.delta)){
melhor = {candidato,pos,delta};
}
}
}

if(!melhor){
// Se alguma combinação da matriz estiver indisponível, completa sem travar.
for(const candidato of restantes) rota.push(candidato);
break;
}
rota.splice(melhor.pos,0,melhor.candidato);
restantes.delete(melhor.candidato);
}
return rota;
}

function deltaRealocacaoGlobal(ordem, i, novaPosicao, resultado, norm, indiceDestinoFinal){
const x = ordem[i];
const reduzida = [...ordem.slice(0,i), ...ordem.slice(i+1)];
const pos = Math.max(0, Math.min(novaPosicao, reduzida.length));

const prevRem = i === 0 ? 0 : ordem[i-1];
const nextRem = i === ordem.length-1 ? (Number.isInteger(indiceDestinoFinal) ? indiceDestinoFinal : null) : ordem[i+1];
let delta = -custoMatrizEquilibrado(resultado, prevRem, x, norm);
if(nextRem !== null){
delta -= custoMatrizEquilibrado(resultado, x, nextRem, norm);
delta += custoMatrizEquilibrado(resultado, prevRem, nextRem, norm);
}

const prevIns = pos === 0 ? 0 : reduzida[pos-1];
const nextIns = pos < reduzida.length ? reduzida[pos] : (Number.isInteger(indiceDestinoFinal) ? indiceDestinoFinal : null);
if(nextIns !== null){
delta -= custoMatrizEquilibrado(resultado, prevIns, nextIns, norm);
delta += custoMatrizEquilibrado(resultado, prevIns, x, norm);
delta += custoMatrizEquilibrado(resultado, x, nextIns, norm);
}else{
delta += custoMatrizEquilibrado(resultado, prevIns, x, norm);
}
return delta;
}

function melhorRealocacaoGlobal(ordem, resultado, norm, indiceDestinoFinal){
let melhor = null;
for(let i=0;i<ordem.length;i++){
for(let p=0;p<=ordem.length-1;p++){
// Inserir no mesmo lugar após remover não muda a rota.
if(p === i) continue;
const delta = deltaRealocacaoGlobal(ordem, i, p, resultado, norm, indiceDestinoFinal);
if(Number.isFinite(delta) && delta < -0.00001 && (!melhor || delta < melhor.delta)){
melhor = {i,p,delta};
}
}
}
return melhor;
}

function aplicarRealocacao(ordem, movimento){
const nova = [...ordem];
const [x] = nova.splice(movimento.i,1);
const pos = Math.max(0, Math.min(movimento.p, nova.length));
nova.splice(pos,0,x);
return nova;
}

function prefixoDiferencaReversao(ordem, resultado, norm){
const pref = Array(ordem.length).fill(0);
for(let k=0;k<ordem.length-1;k++){
const ida = custoMatrizEquilibrado(resultado, ordem[k], ordem[k+1], norm);
const volta = custoMatrizEquilibrado(resultado, ordem[k+1], ordem[k], norm);
const dif = (Number.isFinite(ida) && Number.isFinite(volta)) ? (volta-ida) : Infinity;
pref[k+1] = Number.isFinite(pref[k]) && Number.isFinite(dif) ? pref[k] + dif : Infinity;
}
return pref;
}

function melhor2OptDirecionalGlobal(ordem, resultado, norm, indiceDestinoFinal){
if(ordem.length < 3) return null;
const pref = prefixoDiferencaReversao(ordem, resultado, norm);
let melhor = null;

for(let i=0;i<ordem.length-1;i++){
const prev = i === 0 ? 0 : ordem[i-1];
for(let j=i+1;j<ordem.length;j++){
const next = j === ordem.length-1 ? (Number.isInteger(indiceDestinoFinal) ? indiceDestinoFinal : null) : ordem[j+1];
const a = ordem[i];
const b = ordem[j];

let delta = -custoMatrizEquilibrado(resultado, prev, a, norm)
+ custoMatrizEquilibrado(resultado, prev, b, norm);

if(next !== null){
delta -= custoMatrizEquilibrado(resultado, b, next, norm);
delta += custoMatrizEquilibrado(resultado, a, next, norm);
}

const interno = pref[j] - pref[i];
if(!Number.isFinite(delta) || !Number.isFinite(interno)) continue;
delta += interno;

if(delta < -0.00001 && (!melhor || delta < melhor.delta)) melhor = {i,j,delta};
}
}
return melhor;
}

function aplicar2Opt(ordem, movimento){
return [
...ordem.slice(0,movimento.i),
...ordem.slice(movimento.i,movimento.j+1).reverse(),
...ordem.slice(movimento.j+1)
];
}

function refinarRotaGlobalComMatriz(ordemInicial, resultado, indiceDestinoFinal){
let ordem = [...ordemInicial];
const norm = normalizadoresMatriz(resultado);

// Realocação GLOBAL: cada parada pode ir para qualquer posição da rota.
// Repetimos as melhores mudanças até estabilizar ou atingir um limite de
// segurança de CPU para manter o uso confortável no celular.
for(let iter=0;iter<Math.min(80, ordem.length*2);iter++){
const mov = melhorRealocacaoGlobal(ordem, resultado, norm, indiceDestinoFinal);
if(!mov) break;
ordem = aplicarRealocacao(ordem, mov);
}

// 2-opt direcional GLOBAL: inverte segmentos inteiros levando em conta que
// o custo das ruas muda conforme o sentido percorrido.
for(let iter=0;iter<Math.min(30, ordem.length);iter++){
const mov = melhor2OptDirecionalGlobal(ordem, resultado, norm, indiceDestinoFinal);
if(!mov) break;
ordem = aplicar2Opt(ordem, mov);
}

// Uma última rodada de realocação captura oportunidades abertas pelo 2-opt.
for(let iter=0;iter<Math.min(40, ordem.length);iter++){
const mov = melhorRealocacaoGlobal(ordem, resultado, norm, indiceDestinoFinal);
if(!mov) break;
ordem = aplicarRealocacao(ordem, mov);
}

return ordem;
}

function gerarCandidatasGlobaisMatriz(validos, ordemShopee, resultado, indiceDestinoFinal){
const indices = validos.map((_,i)=>i+1);
const idParaIndice = new Map(validos.map((g,i)=>[g.id,i+1]));
const norm = normalizadoresMatriz(resultado);
const candidatas = [];
const vistas = new Set();

function adicionar(nome, ordemIndices){
if(!ordemIndices || ordemIndices.length !== indices.length) return;
const assinatura = ordemIndices.join('>');
if(vistas.has(assinatura)) return;
vistas.add(assinatura);
candidatas.push({nome, ordemIndices:[...ordemIndices]});
}

adicionar('shopee', ordemShopee.map(g=>idParaIndice.get(g.id)).filter(Number.isInteger));
adicionar('vizinho-global', rotaVizinhoGlobalMatriz(indices, resultado, norm, null));
adicionar('insercao-global', rotaInsercaoGlobalMatriz(indices, resultado, norm, indiceDestinoFinal));

// Começos alternativos globais. O restante da rota continua podendo se mover
// livremente durante o refinamento, então não criamos blocos ou setores fixos.
const melhoresPrimeiros = [...indices]
.map(i=>({i,c:custoMatrizEquilibrado(resultado,0,i,norm)}))
.filter(x=>Number.isFinite(x.c))
.sort((a,b)=>a.c-b.c)
.slice(0,5);
melhoresPrimeiros.forEach((x,k)=>adicionar(`inicio-global-${k+1}`, rotaVizinhoGlobalMatriz(indices, resultado, norm, x.i)));

return candidatas;
}

function escolherMelhorGlobalMatriz(candidatas, resultado, indiceDestinoFinal){
const avaliadas = candidatas.map(c=>{
const refinada = refinarRotaGlobalComMatriz(c.ordemIndices, resultado, indiceDestinoFinal);
const metricas = metricasOrdemNaMatriz(refinada, resultado, indiceDestinoFinal);
return {...c, ordemIndices:refinada, metricas};
});

const referencia = referenciaEquilibrio(avaliadas);
const melhor = escolherMelhorAvaliacao(avaliadas, referencia);
return {melhor, avaliadas, referencia};
}


// ----------------------------------------------------------------------
// V7.5 - CLUSTERING + CONTINUIDADE DE RUA + JANELAS DE TEMPO
// ----------------------------------------------------------------------

const RAIO_MICRO_REGIAO_METROS = 280;
const DIAMETRO_MAX_MICRO_REGIAO_METROS = 720;
const PESO_SOFT_SECUNDARIO = 0.08;

function grupoPorIndiceMatriz(indice, validos){
return Number.isInteger(indice) && indice >= 1 && indice <= validos.length ? validos[indice-1] : null;
}

function chaveRuaGrupo(grupo){
if(!grupo) return 'sem-rua';
const norm = normalizarTexto(grupo.endereco || '');
const info = extrairRuaENumero(norm);
if(info && info.rua) return info.rua;
return norm.replace(/\d.*$/,'').replace(/[,;\-]+$/,'').trim() || ('local-' + grupo.id);
}

function tempoServicoGrupoSegundos(grupo){
if(!grupo) return 0;
const salvo = Number(grupo.tempoServicoSegundos);
if(Number.isFinite(salvo) && salvo >= 0) return salvo;
return enderecoParecePredio(grupo.endereco) ? 7*60 : 2*60;
}

function distanciaGeograficaIndices(i, j, validos){
const a = grupoPorIndiceMatriz(i, validos);
const b = grupoPorIndiceMatriz(j, validos);
if(!a || !b) return Infinity;
return distanciaMetros(Number(a.lat),Number(a.lng),Number(b.lat),Number(b.lng));
}

function dividirClusterPorDiametro(indices, validos){
if(indices.length <= 2) return [indices];
let maior = -1;
let sementes = [indices[0], indices[1]];
for(let a=0;a<indices.length;a++){
for(let b=a+1;b<indices.length;b++){
const d = distanciaGeograficaIndices(indices[a],indices[b],validos);
if(Number.isFinite(d) && d > maior){ maior=d; sementes=[indices[a],indices[b]]; }
}
}
if(maior <= DIAMETRO_MAX_MICRO_REGIAO_METROS) return [indices];

const esquerda=[];
const direita=[];
indices.forEach(i=>{
const dA = distanciaGeograficaIndices(i,sementes[0],validos);
const dB = distanciaGeograficaIndices(i,sementes[1],validos);
(dA <= dB ? esquerda : direita).push(i);
});

if(!esquerda.length || !direita.length){
const ordenados=[...indices].sort((a,b)=>{
const ga=grupoPorIndiceMatriz(a,validos), gb=grupoPorIndiceMatriz(b,validos);
return Number(ga.lat)-Number(gb.lat) || Number(ga.lng)-Number(gb.lng);
});
const meio=Math.ceil(ordenados.length/2);
return [ordenados.slice(0,meio),ordenados.slice(meio)].flatMap(c=>dividirClusterPorDiametro(c,validos));
}
return [esquerda,direita].flatMap(c=>dividirClusterPorDiametro(c,validos));
}

function clusterizarMicroRegioesV75(validos){
const indices=validos.map((_,i)=>i+1);
const naoVisitados=new Set(indices);
const componentes=[];

while(naoVisitados.size){
const primeiro=naoVisitados.values().next().value;
naoVisitados.delete(primeiro);
const fila=[primeiro];
const comp=[];
while(fila.length){
const atual=fila.shift();
comp.push(atual);
for(const cand of [...naoVisitados]){
const d=distanciaGeograficaIndices(atual,cand,validos);
if(Number.isFinite(d) && d <= RAIO_MICRO_REGIAO_METROS){
naoVisitados.delete(cand);
fila.push(cand);
}
}
}
componentes.push(...dividirClusterPorDiametro(comp,validos));
}

return componentes.map((membros,id)=>({id,membros:[...membros]}));
}

function custoEntreConjuntosMatriz(origens, destinos, resultado, norm){
let melhor=Infinity;
for(const a of origens){
for(const b of destinos){
const c=custoMatrizEquilibrado(resultado,a,b,norm);
if(Number.isFinite(c) && c<melhor) melhor=c;
}
}
return melhor;
}

function ordemClustersVizinhoV75(clusters, resultado, norm, primeiroId){
const restantes=[...clusters];
const ordem=[];
let atual=[0];

if(Number.isInteger(primeiroId)){
const pos=restantes.findIndex(c=>c.id===primeiroId);
if(pos>=0){
const escolhido=restantes.splice(pos,1)[0];
ordem.push(escolhido);
atual=escolhido.membros;
}
}

while(restantes.length){
let melhorPos=0, melhorC=Infinity;
restantes.forEach((c,pos)=>{
const custo=custoEntreConjuntosMatriz(atual,c.membros,resultado,norm);
if(custo<melhorC){melhorC=custo;melhorPos=pos;}
});
const escolhido=restantes.splice(melhorPos,1)[0];
ordem.push(escolhido);
atual=escolhido.membros;
}
return ordem;
}

function gerarOrdensClustersV75(clusters, validos, resultado, norm){
const ordens=[];
const vistas=new Set();
function add(nome,ordem){
const sig=ordem.map(c=>c.id).join('>');
if(!sig || vistas.has(sig)) return;
vistas.add(sig); ordens.push({nome,ordem});
}

const original=[...clusters].sort((a,b)=>{
const ia=Math.min(...a.membros.map(i=>validos[i-1].indiceImportacao ?? Infinity));
const ib=Math.min(...b.membros.map(i=>validos[i-1].indiceImportacao ?? Infinity));
return ia-ib;
});
add('clusters-shopee',original);
add('clusters-vizinho',ordemClustersVizinhoV75(clusters,resultado,norm,null));
add('clusters-invertida',[...original].reverse());

const primeiros=[...clusters]
.map(c=>({id:c.id,c:custoEntreConjuntosMatriz([0],c.membros,resultado,norm)}))
.filter(x=>Number.isFinite(x.c)).sort((a,b)=>a.c-b.c).slice(0,Math.min(5,clusters.length));
primeiros.forEach((x,k)=>add('clusters-inicio-'+(k+1),ordemClustersVizinhoV75(clusters,resultado,norm,x.id)));
return ordens;
}

function candidatosOrdemRuaV75(membros, atual, alvosSaida, resultado, norm, validos){
const candidatas=[];
const vistas=new Set();
function add(arr){
if(!arr || arr.length!==membros.length) return;
const sig=arr.join('>');
if(!vistas.has(sig)){vistas.add(sig);candidatas.push(arr);}
}

// Vizinho direcional partindo da posição real de entrada na rua.
let rest=[...membros];
let cur=atual;
const greedy=[];
while(rest.length){
let p=0,c=Infinity;
rest.forEach((idx,k)=>{
const cc=custoMatrizEquilibrado(resultado,cur,idx,norm);
if(cc<c){c=cc;p=k;}
});
const escolhido=rest.splice(p,1)[0];
greedy.push(escolhido); cur=escolhido;
}
add(greedy);
add([...greedy].reverse());

const shopee=[...membros].sort((a,b)=>(validos[a-1].indiceImportacao??0)-(validos[b-1].indiceImportacao??0));
add(shopee); add([...shopee].reverse());

function custo(arr){
let total=0,ant=atual;
for(const x of arr){
const c=custoMatrizEquilibrado(resultado,ant,x,norm);
if(!Number.isFinite(c)) return Infinity;
total+=c;ant=x;
}
if(alvosSaida && alvosSaida.length){
const saida=custoEntreConjuntosMatriz([ant],alvosSaida,resultado,norm);
if(Number.isFinite(saida)) total+=saida;
}
return total;
}
return candidatas.sort((a,b)=>custo(a)-custo(b))[0] || [...membros];
}

function expandirClustersERuasV75(ordemClusters, validos, resultado, norm, indiceDestinoFinal){
const rota=[];
let atual=0;

for(let ci=0;ci<ordemClusters.length;ci++){
const cluster=ordemClusters[ci];
const ruasMap=new Map();
cluster.membros.forEach(idx=>{
const chave=chaveRuaGrupo(validos[idx-1]);
if(!ruasMap.has(chave)) ruasMap.set(chave,[]);
ruasMap.get(chave).push(idx);
});
let ruas=[...ruasMap.entries()].map(([chave,membros])=>({chave,membros}));

while(ruas.length){
let melhorPos=0,melhorC=Infinity;
ruas.forEach((r,pos)=>{
const c=custoEntreConjuntosMatriz([atual],r.membros,resultado,norm);
if(c<melhorC){melhorC=c;melhorPos=pos;}
});
const rua=ruas.splice(melhorPos,1)[0];

const alvosSaida=ruas.flatMap(r=>r.membros);
if(!alvosSaida.length && ci<ordemClusters.length-1) alvosSaida.push(...ordemClusters[ci+1].membros);
if(!alvosSaida.length && Number.isInteger(indiceDestinoFinal)) alvosSaida.push(indiceDestinoFinal);

// REGRA CENTRAL DO TESTE: ao entrar numa rua, todas as entregas dessa rua
// dentro da micro-região são resolvidas de forma contínua antes de sair.
const ordemRua=candidatosOrdemRuaV75(rua.membros,atual,alvosSaida,resultado,norm,validos);
rota.push(...ordemRua);
atual=ordemRua[ordemRua.length-1] ?? atual;
}
}
return rota;
}

function minutosAgoraDia(){
const d=new Date();
return d.getHours()*60+d.getMinutes()+d.getSeconds()/60;
}

function avaliarJanelasRotaV75(ordem, resultado, validos){
let atual=0;
let tempoSeg=0;
const inicioMin=minutosAgoraDia();
const violacoesHard=[];
let atrasoHardMin=0;
let penalidadeSoftMin=0;
const etas=new Map();

for(const idx of ordem){
const viagem=valorMatriz(resultado.duracoes,atual,idx);
if(Number.isFinite(viagem)) tempoSeg+=viagem;
const chegadaMin=inicioMin+tempoSeg/60;
etas.set(idx,chegadaMin);
const g=grupoPorIndiceMatriz(idx,validos);

if(g && Number.isFinite(g.janelaHardMin) && chegadaMin>g.janelaHardMin){
const atraso=chegadaMin-g.janelaHardMin;
violacoesHard.push({idx,atraso,limite:g.janelaHardMin,eta:chegadaMin});
atrasoHardMin+=atraso;
}

if(g && Number.isFinite(g.janelaSoftInicioMin) && Number.isFinite(g.janelaSoftFimMin)){
if(chegadaMin<g.janelaSoftInicioMin) penalidadeSoftMin += g.janelaSoftInicioMin-chegadaMin;
else if(chegadaMin>g.janelaSoftFimMin) penalidadeSoftMin += chegadaMin-g.janelaSoftFimMin;
}

tempoSeg+=tempoServicoGrupoSegundos(g);
atual=idx;
}
return {violacoesHard,atrasoHardMin,penalidadeSoftMin,etas,tempoOperacionalSegundos:tempoSeg};
}

function moverIndiceRota(ordem,de,para){
const n=[...ordem];
const [x]=n.splice(de,1);
n.splice(Math.max(0,Math.min(para,n.length)),0,x);
return n;
}

function repararJanelasHardV75(ordemInicial, resultado, validos){
let ordem=[...ordemInicial];
for(let tentativa=0;tentativa<Math.min(20,ordem.length);tentativa++){
const atual=avaliarJanelasRotaV75(ordem,resultado,validos);
if(!atual.violacoesHard.length) return ordem;
const alvo=[...atual.violacoesHard].sort((a,b)=>a.limite-b.limite || b.atraso-a.atraso)[0];
const posAtual=ordem.indexOf(alvo.idx);
if(posAtual<=0) break;
let melhor=null;
for(let novaPos=0;novaPos<posAtual;novaPos++){
const cand=moverIndiceRota(ordem,posAtual,novaPos);
const av=avaliarJanelasRotaV75(cand,resultado,validos);
const chave=[av.violacoesHard.length,av.atrasoHardMin,av.penalidadeSoftMin];
if(!melhor || chave[0]<melhor.chave[0] || (chave[0]===melhor.chave[0] && (chave[1]<melhor.chave[1]-0.01 || (Math.abs(chave[1]-melhor.chave[1])<0.01 && chave[2]<melhor.chave[2])))){
melhor={ordem:cand,chave};
}
}
if(!melhor || (melhor.chave[0]>=atual.violacoesHard.length && melhor.chave[1]>=atual.atrasoHardMin-0.01)) break;
ordem=melhor.ordem;
}
return ordem;
}

function metricasOperacionaisMatrizV75(ordem, resultado, indiceDestinoFinal, validos){
const base=metricasOrdemNaMatriz(ordem,resultado,indiceDestinoFinal);
const servico=ordem.reduce((acc,idx)=>acc+tempoServicoGrupoSegundos(grupoPorIndiceMatriz(idx,validos)),0);
return {...base,duracao:Number.isFinite(base.duracao)?base.duracao+servico:null,tempoServico:servico};
}

function gerarCandidatasV75(validos, ordemShopee, resultado, indiceDestinoFinal){
const norm=normalizadoresMatriz(resultado);
const clusters=clusterizarMicroRegioesV75(validos);
const ordensClusters=gerarOrdensClustersV75(clusters,validos,resultado,norm);
const candidatas=[];
const vistas=new Set();

for(const c of ordensClusters){
let ordemIndices=expandirClustersERuasV75(c.ordem,validos,resultado,norm,indiceDestinoFinal);
ordemIndices=repararJanelasHardV75(ordemIndices,resultado,validos);
const sig=ordemIndices.join('>');
if(!vistas.has(sig)){
vistas.add(sig);
candidatas.push({nome:c.nome,ordemIndices});
}
}

// A ordem original NÃO entra como candidata de otimização nesta versão. Ela é
// calculada separadamente apenas para comparação. Isso impede o motor de
// escolher uma sequência que viole micro-regiões/continuidade de rua só
// porque a ordem original teve um score matemático menor.
return {candidatas,clusters};
}

function escolherMelhorV75(candidatas, resultado, indiceDestinoFinal, validos){
const avaliadas=candidatas.map(c=>{
const janelas=avaliarJanelasRotaV75(c.ordemIndices,resultado,validos);
const metricas=metricasOperacionaisMatrizV75(c.ordemIndices,resultado,indiceDestinoFinal,validos);
return {...c,janelas,metricas};
});
const factiveis=avaliadas.filter(a=>a.janelas.violacoesHard.length===0 && metricasRotaValidas(a.metricas));
const base=factiveis.length?factiveis:avaliadas.filter(a=>metricasRotaValidas(a.metricas));
if(!base.length) return {melhor:null,avaliadas,referencia:null};
const referencia=referenciaEquilibrio(base);
let melhor=null;
for(const a of base){
let score=pontuacaoEquilibrada(a.metricas,referencia);
if(!Number.isFinite(score)) continue;
// Hard é obrigatório: se nenhuma candidata for factível, atraso recebe custo
// enorme para escolher a menos ruim e avisar o usuário.
if(a.janelas.violacoesHard.length) score += 1000 + a.janelas.atrasoHardMin*10;
// Soft é secundário e jamais domina tempo+quilometragem.
score += PESO_SOFT_SECUNDARIO * (a.janelas.penalidadeSoftMin / Math.max(1,a.metricas.duracao/60));
if(!melhor || score<melhor.score) melhor={...a,score};
}
return {melhor,avaliadas,referencia};
}


// ----------------------------------------------------------------------
// V7.6 - MODELO SCANNER / SERPENTINA
// ----------------------------------------------------------------------
/*
REFERÊNCIA DE COMPORTAMENTO V7.6

A rota desenhada pelo usuário em verde serve como princípio geométrico:
- evitar saltos entre pontos que fazem o motorista cruzar a mesma área várias vezes;
- "varrer" uma região como a cabeça de uma impressora;
- fechar uma faixa/rua antes de passar para a próxima faixa paralela;
- alternar o sentido das faixas (serpentina) quando isso reduz retornos;
- se uma parada futura estiver praticamente no caminho entre duas paradas e
  incluí-la não criar desvio viário relevante, atendê-la naquele momento;
- manter ponto inicial, ponto final, mão única/retornos e custo direcional;
- janelas HARD continuam acima do scanner quando existirem dados reais;
- tempo pelas vias é prioridade; quilômetros entram em segundo lugar;

A V7.5 foi preservada separadamente para rollback caso este modelo não se
comporte melhor em rotas reais.
*/

const RAIO_ZONA_SCANNER_METROS = 760;
const DIAMETRO_MAX_ZONA_SCANNER_METROS = 1900;
const LARGURAS_FAIXA_SCANNER = [55, 80, 115, 155];
const RAIO_CAPTURA_CAMINHO_METROS = 70;
const FATOR_MAX_DESVIO_CAPTURA = 1.28;

function normalizarAnguloScanner(a){
let x=a % Math.PI;
if(x<0) x+=Math.PI;
return x;
}

function diferencaAngularScanner(a,b){
const x=Math.abs(normalizarAnguloScanner(a)-normalizarAnguloScanner(b));
return Math.min(x,Math.PI-x);
}

function coordsLocaisScanner(indices,validos){
if(!indices.length) return {map:new Map(),refLat:0,refLng:0};
let refLat=0,refLng=0;
indices.forEach(i=>{
const g=grupoPorIndiceMatriz(i,validos);
refLat+=Number(g.lat); refLng+=Number(g.lng);
});
refLat/=indices.length; refLng/=indices.length;
const cos=Math.cos(refLat*Math.PI/180);
const map=new Map();
indices.forEach(i=>{
const g=grupoPorIndiceMatriz(i,validos);
const x=(Number(g.lng)-refLng)*111320*cos;
const y=(Number(g.lat)-refLat)*111320;
map.set(i,{x,y});
});
return {map,refLat,refLng};
}

function anguloPcaScanner(indices,validos){
if(indices.length<2) return 0;
const {map}=coordsLocaisScanner(indices,validos);
let mx=0,my=0;
indices.forEach(i=>{const p=map.get(i);mx+=p.x;my+=p.y;});
mx/=indices.length;my/=indices.length;
let xx=0,yy=0,xy=0;
indices.forEach(i=>{
const p=map.get(i); const dx=p.x-mx,dy=p.y-my;
xx+=dx*dx;yy+=dy*dy;xy+=dx*dy;
});
return normalizarAnguloScanner(0.5*Math.atan2(2*xy,xx-yy));
}

function anguloDominanteVizinhancaScanner(indices,validos){
if(indices.length<2) return anguloPcaScanner(indices,validos);
const {map}=coordsLocaisScanner(indices,validos);
const bins=18;
const pesos=Array(bins).fill(0);
for(let a=0;a<indices.length;a++){
for(let b=a+1;b<indices.length;b++){
const p=map.get(indices[a]),q=map.get(indices[b]);
const dx=q.x-p.x,dy=q.y-p.y;
const d=Math.hypot(dx,dy);
if(d<25 || d>360) continue;
const ang=normalizarAnguloScanner(Math.atan2(dy,dx));
const bi=Math.min(bins-1,Math.floor(ang/Math.PI*bins));
// Vizinhos próximos têm mais chance de compartilhar a mesma rua/faixa.
pesos[bi]+=1/Math.max(35,d);
}
}
let melhor=0;
for(let i=1;i<bins;i++) if(pesos[i]>pesos[melhor]) melhor=i;
if(pesos[melhor]<=0) return anguloPcaScanner(indices,validos);
return normalizarAnguloScanner((melhor+0.5)*Math.PI/bins);
}

function angulosCandidatosScanner(indices,validos){
const dom=anguloDominanteVizinhancaScanner(indices,validos);
const pca=anguloPcaScanner(indices,validos);
const brutos=[dom,dom+Math.PI/2,pca,pca+Math.PI/2];
const saida=[];
brutos.forEach(a=>{
const n=normalizarAnguloScanner(a);
if(!saida.some(x=>diferencaAngularScanner(x,n)<Math.PI/36)) saida.push(n);
});
return saida;
}

function dividirZonaScannerPorDiametro(indices,validos){
if(indices.length<=2) return [indices];
let maior=-1,sementes=[indices[0],indices[1]];
for(let a=0;a<indices.length;a++){
for(let b=a+1;b<indices.length;b++){
const d=distanciaGeograficaIndices(indices[a],indices[b],validos);
if(Number.isFinite(d)&&d>maior){maior=d;sementes=[indices[a],indices[b]];}
}
}
if(maior<=DIAMETRO_MAX_ZONA_SCANNER_METROS) return [indices];
const A=[],B=[];
indices.forEach(i=>{
const da=distanciaGeograficaIndices(i,sementes[0],validos);
const db=distanciaGeograficaIndices(i,sementes[1],validos);
(da<=db?A:B).push(i);
});
if(!A.length||!B.length){
const ord=[...indices].sort((i,j)=>{
const a=grupoPorIndiceMatriz(i,validos),b=grupoPorIndiceMatriz(j,validos);
return Number(a.lat)-Number(b.lat)||Number(a.lng)-Number(b.lng);
});
const meio=Math.ceil(ord.length/2);
return [ord.slice(0,meio),ord.slice(meio)].flatMap(x=>dividirZonaScannerPorDiametro(x,validos));
}
return [A,B].flatMap(x=>dividirZonaScannerPorDiametro(x,validos));
}

function clusterizarZonasScannerV76(validos){
const indices=validos.map((_,i)=>i+1);
const nao=new Set(indices);
const comps=[];
while(nao.size){
const primeiro=nao.values().next().value;
nao.delete(primeiro);
const fila=[primeiro],comp=[];
while(fila.length){
const atual=fila.shift();comp.push(atual);
for(const cand of [...nao]){
const d=distanciaGeograficaIndices(atual,cand,validos);
if(Number.isFinite(d)&&d<=RAIO_ZONA_SCANNER_METROS){
nao.delete(cand);fila.push(cand);
}
}
}
comps.push(...dividirZonaScannerPorDiametro(comp,validos));
}
return comps.map((membros,id)=>({id,membros:[...membros]}));
}

function ordemZonasScannerVizinho(zonas,resultado,norm,primeiroId){
const restantes=[...zonas],ordem=[];
let atual=[0];
if(Number.isInteger(primeiroId)){
const pos=restantes.findIndex(z=>z.id===primeiroId);
if(pos>=0){const z=restantes.splice(pos,1)[0];ordem.push(z);atual=z.membros;}
}
while(restantes.length){
let p=0,c=Infinity;
restantes.forEach((z,k)=>{
const cc=custoEntreConjuntosMatriz(atual,z.membros,resultado,norm);
if(cc<c){c=cc;p=k;}
});
const z=restantes.splice(p,1)[0];ordem.push(z);atual=z.membros;
}
return ordem;
}

function gerarOrdensZonasScanner(zonas,validos,resultado,norm){
const saida=[],vistas=new Set();
function add(nome,ordem){
const sig=ordem.map(z=>z.id).join('>');
if(!sig||vistas.has(sig)) return;
vistas.add(sig);saida.push({nome,ordem});
}
const viz=ordemZonasScannerVizinho(zonas,resultado,norm,null);
add('zonas-vizinho',viz);
add('zonas-vizinho-invertida',[...viz].reverse());
const original=[...zonas].sort((a,b)=>{
const ia=Math.min(...a.membros.map(i=>validos[i-1].indiceImportacao??Infinity));
const ib=Math.min(...b.membros.map(i=>validos[i-1].indiceImportacao??Infinity));
return ia-ib;
});
add('zonas-orientacao-shopee',original);
const primeiros=[...zonas].map(z=>({id:z.id,c:custoEntreConjuntosMatriz([0],z.membros,resultado,norm)}))
.filter(x=>Number.isFinite(x.c)).sort((a,b)=>a.c-b.c).slice(0,Math.min(4,zonas.length));
primeiros.forEach((x,k)=>add('zonas-inicio-'+(k+1),ordemZonasScannerVizinho(zonas,resultado,norm,x.id)));
return saida;
}

function criarFaixasScannerZona(indices,validos,angulo,largura){
const {map}=coordsLocaisScanner(indices,validos);
const ca=Math.cos(angulo),sa=Math.sin(angulo);
const pontos=indices.map(i=>{
const p=map.get(i);
return {i,s:p.x*ca+p.y*sa,t:-p.x*sa+p.y*ca};
}).sort((a,b)=>a.t-b.t);

const faixas=[];
for(const p of pontos){
let alvo=null,melhor=Infinity;
for(const f of faixas){
const d=Math.abs(p.t-f.mediaT);
if(d<=largura&&d<melhor){alvo=f;melhor=d;}
}
if(!alvo){
alvo={itens:[],mediaT:p.t};faixas.push(alvo);
}
alvo.itens.push(p);
alvo.mediaT=alvo.itens.reduce((acc,x)=>acc+x.t,0)/alvo.itens.length;
}
faixas.sort((a,b)=>a.mediaT-b.mediaT);
faixas.forEach(f=>f.itens.sort((a,b)=>a.s-b.s));
return faixas;
}

function custoSequenciaScanner(indices,atual,alvosSaida,resultado,norm){
let total=0,ant=atual;
for(const idx of indices){
const c=custoMatrizEquilibrado(resultado,ant,idx,norm);
if(!Number.isFinite(c)) return Infinity;
total+=c;ant=idx;
}
if(alvosSaida&&alvosSaida.length){
const c=custoEntreConjuntosMatriz([ant],alvosSaida,resultado,norm);
if(Number.isFinite(c)) total+=c;
}
return total;
}

function ordensSerpentinaFaixas(faixas,atual,alvosSaida,resultado,norm){
if(!faixas.length) return [];
const candidatas=[];
for(const ordemFaixas of [faixas,[...faixas].reverse()]){
for(const primeiroSentido of [1,-1]){
const seq=[];
ordemFaixas.forEach((f,k)=>{
const base=f.itens.map(x=>x.i);
const sentido=(k%2===0?primeiroSentido:-primeiroSentido);
seq.push(...(sentido===1?base:[...base].reverse()));
});
candidatas.push(seq);
}
}
candidatas.sort((a,b)=>custoSequenciaScanner(a,atual,alvosSaida,resultado,norm)-custoSequenciaScanner(b,atual,alvosSaida,resultado,norm));
return candidatas;
}

function distanciaPontoSegmentoMetrosScanner(p,a,b){
const vx=b.x-a.x,vy=b.y-a.y;
const wx=p.x-a.x,wy=p.y-a.y;
const den=vx*vx+vy*vy;
if(den<=1e-9) return {dist:Math.hypot(wx,wy),t:0};
const t=Math.max(0,Math.min(1,(wx*vx+wy*vy)/den));
const qx=a.x+t*vx,qy=a.y+t*vy;
return {dist:Math.hypot(p.x-qx,p.y-qy),t};
}

function capturarParadasNoCaminhoScanner(ordemInicial,resultado,norm,validos){
let ordem=[...ordemInicial];
if(ordem.length<3) return ordem;
const todos=ordem;
const {map}=coordsLocaisScanner(todos,validos);

for(let passada=0;passada<2;passada++){
let mudou=false;
for(let k=1;k<ordem.length;k++){
const aIdx=ordem[k-1],bIdx=ordem[k];
const a=map.get(aIdx),b=map.get(bIdx);
if(!a||!b) continue;
const custoAB=custoMatrizEquilibrado(resultado,aIdx,bIdx,norm);
if(!Number.isFinite(custoAB)||custoAB<=0) continue;
let melhor=null;
for(let j=k+1;j<ordem.length;j++){
const pIdx=ordem[j],p=map.get(pIdx);
if(!p) continue;
const geo=distanciaPontoSegmentoMetrosScanner(p,a,b);
if(geo.dist>RAIO_CAPTURA_CAMINHO_METROS||geo.t<0.08||geo.t>0.94) continue;
const c1=custoMatrizEquilibrado(resultado,aIdx,pIdx,norm);
const c2=custoMatrizEquilibrado(resultado,pIdx,bIdx,norm);
if(!Number.isFinite(c1)||!Number.isFinite(c2)) continue;
const fator=(c1+c2)/Math.max(1,custoAB);
if(fator>FATOR_MAX_DESVIO_CAPTURA) continue;
const chave=geo.dist+fator*25;
if(!melhor||chave<melhor.chave) melhor={j,pIdx,chave};
}
if(melhor){
ordem.splice(melhor.j,1);
ordem.splice(k,0,melhor.pIdx);
mudou=true;k++;
}
}
if(!mudou) break;
}
return ordem;
}

function penalidadeContinuidadeScanner(ordem,validos){
if(ordem.length<3) return 0;
let penal=0;
const restantes=new Set(ordem);
for(let pos=0;pos<ordem.length-1;pos++){
const atual=ordem[pos],prox=ordem[pos+1];
restantes.delete(atual);
const dProx=distanciaGeograficaIndices(atual,prox,validos);
let perto=Infinity;
for(const cand of restantes){
if(cand===prox) continue;
const d=distanciaGeograficaIndices(atual,cand,validos);
if(d<perto) perto=d;
}
// Se existe entrega ainda não feita muito perto, mas a sequência salta bem
// mais longe, adicionamos custo operacional para evitar abandonar a região.
if(Number.isFinite(perto)&&perto<180&&Number.isFinite(dProx)&&dProx>Math.max(330,perto*3.2)){
penal+=(dProx-perto)/1000;
}
}
return penal;
}

function melhorScannerDaZona(zona,atual,alvosSaida,resultado,norm,validos){
if(zona.membros.length<=1) return [...zona.membros];
const candidatas=[],vistas=new Set();
const angulos=angulosCandidatosScanner(zona.membros,validos);
for(const angulo of angulos){
for(const largura of LARGURAS_FAIXA_SCANNER){
const faixas=criarFaixasScannerZona(zona.membros,validos,angulo,largura);
for(const seq of ordensSerpentinaFaixas(faixas,atual,alvosSaida,resultado,norm)){
const sig=seq.join('>');
if(!vistas.has(sig)){vistas.add(sig);candidatas.push(seq);}
}
}
}
// Segurança: rua contínua da V7.5 também entra como variante local, mas nunca
// substitui o scanner global. Ela ajuda quando o nome da rua está muito claro.
const ruasMap=new Map();
zona.membros.forEach(idx=>{
const k=chaveRuaGrupo(validos[idx-1]);
if(!ruasMap.has(k)) ruasMap.set(k,[]);
ruasMap.get(k).push(idx);
});
if(ruasMap.size>1){
let ruas=[...ruasMap.values()],seq=[],cur=atual;
while(ruas.length){
let p=0,c=Infinity;
ruas.forEach((r,k)=>{const cc=custoEntreConjuntosMatriz([cur],r,resultado,norm);if(cc<c){c=cc;p=k;}});
const r=ruas.splice(p,1)[0];
const saida=ruas.flat();
const ord=candidatosOrdemRuaV75(r,cur,saida,resultado,norm,validos);
seq.push(...ord);cur=ord[ord.length-1]??cur;
}
const sig=seq.join('>');if(!vistas.has(sig)){vistas.add(sig);candidatas.push(seq);}
}

let melhor=null;
for(const c of candidatas){
const capt=capturarParadasNoCaminhoScanner(c,resultado,norm,validos);
const custo=custoSequenciaScanner(capt,atual,alvosSaida,resultado,norm);
const continuidade=penalidadeContinuidadeScanner(capt,validos);
const score=custo*(1+Math.min(.06,continuidade*.015));
if(!melhor||score<melhor.score) melhor={seq:capt,score};
}
return melhor?melhor.seq:[...zona.membros];
}

function expandirZonasScannerV76(ordemZonas,validos,resultado,norm,indiceDestinoFinal){
const rota=[];
let atual=0;
for(let zi=0;zi<ordemZonas.length;zi++){
const zona=ordemZonas[zi];
const saida=[];
if(zi<ordemZonas.length-1) saida.push(...ordemZonas[zi+1].membros);
else if(Number.isInteger(indiceDestinoFinal)) saida.push(indiceDestinoFinal);
const seq=melhorScannerDaZona(zona,atual,saida,resultado,norm,validos);
rota.push(...seq);
atual=seq[seq.length-1]??atual;
}
return capturarParadasNoCaminhoScanner(rota,resultado,norm,validos);
}

function gerarCandidatasScannerV76(validos,resultado,indiceDestinoFinal){
const norm=normalizadoresMatriz(resultado);
const zonas=clusterizarZonasScannerV76(validos);
const ordensZonas=gerarOrdensZonasScanner(zonas,validos,resultado,norm);
const candidatas=[],vistas=new Set();
for(const zc of ordensZonas){
let ordemIndices=expandirZonasScannerV76(zc.ordem,validos,resultado,norm,indiceDestinoFinal);
ordemIndices=repararJanelasHardV75(ordemIndices,resultado,validos);
const sig=ordemIndices.join('>');
if(sig&&!vistas.has(sig)){
vistas.add(sig);candidatas.push({nome:'scanner-'+zc.nome,ordemIndices});
}
}
return {candidatas,zonas};
}

function escolherMelhorScannerV76(candidatas,resultado,indiceDestinoFinal,validos){
const avaliadas=candidatas.map(c=>{
const janelas=avaliarJanelasRotaV75(c.ordemIndices,resultado,validos);
const metricas=metricasOperacionaisMatrizV75(c.ordemIndices,resultado,indiceDestinoFinal,validos);
const continuidade=penalidadeContinuidadeScanner(c.ordemIndices,validos);
return {...c,janelas,metricas,continuidade};
});
const factiveis=avaliadas.filter(a=>a.janelas.violacoesHard.length===0&&metricasRotaValidas(a.metricas));
const base=factiveis.length?factiveis:avaliadas.filter(a=>metricasRotaValidas(a.metricas));
if(!base.length) return {melhor:null,avaliadas,referencia:null};
const referencia=referenciaEquilibrio(base);

// V7.7 - seleção hierárquica:
// 1) encontra o menor tempo estimado entre as rotas válidas;
// 2) aceita como equivalentes apenas rotas até 3% mais lentas;
// 3) dentro desse pequeno intervalo, escolhe a menor quilometragem;
// 4) continuidade do Scanner funciona só como desempate leve.
const menorTempo=Math.min(...base.map(a=>a.metricas.duracao));
const faixaTempo=base.filter(a=>a.metricas.duracao<=menorTempo*1.03);
let melhor=null;
for(const a of faixaTempo){
let scoreDist=a.metricas.distancia/Math.max(1,referencia.menorDistancia);
if(a.janelas.violacoesHard.length) scoreDist+=1000+a.janelas.atrasoHardMin*10;
scoreDist+=PESO_SOFT_SECUNDARIO*(a.janelas.penalidadeSoftMin/Math.max(1,a.metricas.duracao/60));
scoreDist+=Math.min(.05,a.continuidade*.012);
if(!melhor ||
   scoreDist<melhor.score-0.0001 ||
   (Math.abs(scoreDist-melhor.score)<=0.0001 && a.metricas.duracao<melhor.metricas.duracao)){
melhor={...a,score:scoreDist};
}
}
return {melhor,avaliadas,referencia};
}



// ----------------------------------------------------------------------
// V7.8 - CLUSTERING POR CORREDORES VIÁRIOS
// ----------------------------------------------------------------------
/*
PRINCÍPIO V7.8

A rota deixa de enxergar apenas "pontos próximos" e passa a trabalhar em
CORREDORES de entrega. Um corredor pode conter ruas diferentes/paralelas
quando elas:
- estão geograficamente próximas;
- têm orientação local semelhante;
- possuem ligação viária barata entre si;
- permitem limpar aquela faixa da cidade sem abandonar a região e voltar.

Hierarquia da otimização:
1) ponto inicial / janelas HARD (quando existirem dados reais);
2) formar corredores viários coerentes;
3) escolher a melhor ordem dos corredores;
4) escolher o melhor sentido de entrada/saída de cada corredor;
5) dentro do corredor, tempo pelas vias é prioridade e km é secundário;
6) só depois avançar para o próximo corredor.

O Scanner V7.6/V7.7 continua disponível como ferramenta LOCAL para organizar
um corredor, mas não decide mais a divisão da rota inteira.
*/

const RAIO_MAX_LIGACAO_CORREDOR_METROS = 560;
const RAIO_LIGACAO_FORTE_CORREDOR_METROS = 170;
const TEMPO_MAX_LIGACAO_CORREDOR_SEG = 240;
const DISTANCIA_MAX_LIGACAO_CORREDOR_METROS = 1800;
const ANGULO_MAX_DIF_CORREDOR_RAD = 42 * Math.PI / 180;
const LARGURA_MAX_CORREDOR_METROS = 430;
const GAP_LONGITUDINAL_CORREDOR_METROS = 620;
const GAP_TRANSVERSAL_CORREDOR_METROS = 260;
const RAIO_ORIENTACAO_LOCAL_METROS = 520;
const BEAM_CORREDORES_LARGURA = 28;
const BEAM_CORREDORES_RAMIFICACAO = 6;

function membrosMesmaRuaV78(indice, validos){
const g=grupoPorIndiceMatriz(indice,validos);
if(!g) return [];
const chave=chaveRuaGrupo(g);
const saida=[];
validos.forEach((x,k)=>{ if(chaveRuaGrupo(x)===chave) saida.push(k+1); });
return saida;
}

function orientacaoLocalCorredorV78(indice, validos){
// Se temos mais de uma entrega na mesma rua, essa é a pista mais confiável
// para a orientação daquele ponto.
const mesmaRua=membrosMesmaRuaV78(indice,validos);
if(mesmaRua.length>=2) return anguloPcaScanner(mesmaRua,validos);

// Caso contrário, estima a direção local olhando as entregas próximas.
const vizinhos=[];
for(let j=1;j<=validos.length;j++){
if(j===indice) continue;
const d=distanciaGeograficaIndices(indice,j,validos);
if(Number.isFinite(d)&&d<=RAIO_ORIENTACAO_LOCAL_METROS) vizinhos.push({i:j,d});
}
vizinhos.sort((a,b)=>a.d-b.d);
const amostra=[indice,...vizinhos.slice(0,5).map(x=>x.i)];
return amostra.length>=2 ? anguloDominanteVizinhancaScanner(amostra,validos) : null;
}

function menorValorDirecionalMatriz(matriz,a,b){
return Math.min(valorMatriz(matriz,a,b),valorMatriz(matriz,b,a));
}

function afinidadeCorredorV78(a,b,validos,resultado,orientacoes){
const geo=distanciaGeograficaIndices(a,b,validos);
if(!Number.isFinite(geo)||geo>RAIO_MAX_LIGACAO_CORREDOR_METROS) return null;

const tempo=menorValorDirecionalMatriz(resultado.duracoes,a,b);
const distVia=menorValorDirecionalMatriz(resultado.distancias,a,b);
const ruaA=chaveRuaGrupo(grupoPorIndiceMatriz(a,validos));
const ruaB=chaveRuaGrupo(grupoPorIndiceMatriz(b,validos));
const mesmaRua=ruaA===ruaB;

// Pontos muito próximos podem formar um corredor mesmo quando não há dados
// suficientes para estimar a orientação local com segurança.
const ligacaoForte=geo<=RAIO_LIGACAO_FORTE_CORREDOR_METROS;

if(!ligacaoForte){
if(Number.isFinite(tempo)&&tempo>TEMPO_MAX_LIGACAO_CORREDOR_SEG) return null;
if(Number.isFinite(distVia)&&distVia>DISTANCIA_MAX_LIGACAO_CORREDOR_METROS) return null;
}

const angA=orientacoes.get(a);
const angB=orientacoes.get(b);
const dif=(Number.isFinite(angA)&&Number.isFinite(angB))?diferencaAngularScanner(angA,angB):null;
const orientacaoCompat=mesmaRua || ligacaoForte || dif===null || dif<=ANGULO_MAX_DIF_CORREDOR_RAD;
if(!orientacaoCompat) return null;

// Score menor = ligação mais natural. Tempo domina; distância e orientação
// servem para separar pontos que só parecem próximos no mapa.
const tempoScore=Number.isFinite(tempo)?tempo/120:geo/250;
const distScore=Number.isFinite(distVia)?distVia/700:geo/350;
const angScore=dif===null?0.25:dif/ANGULO_MAX_DIF_CORREDOR_RAD;
const score=0.62*tempoScore+0.23*distScore+0.15*angScore-(mesmaRua?0.22:0)-(ligacaoForte?0.12:0);
return {score,geo,tempo,distVia,mesmaRua,dif};
}

function projecoesEixoCorredorV78(indices,validos,angulo){
const {map}=coordsLocaisScanner(indices,validos);
const ux=Math.cos(angulo),uy=Math.sin(angulo);
const vx=-uy,vy=ux;
const itens=indices.map(i=>{
const p=map.get(i);
return {i,s:p.x*ux+p.y*uy,t:p.x*vx+p.y*vy};
});
return itens;
}

function dividirComponenteCorredorV78(indices,validos){
if(indices.length<=3) return [indices];
const ang=anguloPcaScanner(indices,validos);
const proj=projecoesEixoCorredorV78(indices,validos,ang);
const ss=proj.map(x=>x.s),ts=proj.map(x=>x.t);
const largura=Math.max(...ts)-Math.min(...ts);

function maiorGap(campo){
const ord=[...proj].sort((a,b)=>a[campo]-b[campo]);
let melhor={gap:-Infinity,pos:-1,ord};
for(let k=1;k<ord.length;k++){
const gap=ord[k][campo]-ord[k-1][campo];
if(gap>melhor.gap) melhor={gap,pos:k,ord};
}
return melhor;
}

const gapT=maiorGap('t');
const gapS=maiorGap('s');
let corte=null;

// Primeiro evita que um componente "vaze" transversalmente para outra
// região. Ainda permitimos várias ruas paralelas no mesmo corredor.
if(largura>LARGURA_MAX_CORREDOR_METROS){
if(gapT.gap>=GAP_TRANSVERSAL_CORREDOR_METROS) corte=gapT;
else{
const ord=[...proj].sort((a,b)=>a.t-b.t);
const meio=Math.ceil(ord.length/2);
corte={ord,pos:meio,gap:0};
}
}else if(gapS.gap>=GAP_LONGITUDINAL_CORREDOR_METROS){
corte=gapS;
}

if(!corte||corte.pos<=0||corte.pos>=corte.ord.length) return [indices];
const A=corte.ord.slice(0,corte.pos).map(x=>x.i);
const B=corte.ord.slice(corte.pos).map(x=>x.i);
if(!A.length||!B.length) return [indices];
return [A,B].flatMap(x=>dividirComponenteCorredorV78(x,validos));
}

function clusterizarCorredoresV78(validos,resultado){
const indices=validos.map((_,k)=>k+1);
const orientacoes=new Map(indices.map(i=>[i,orientacaoLocalCorredorV78(i,validos)]));

// Grafo de afinidade viária/geográfica.
const adj=new Map(indices.map(i=>[i,[]]));
for(let a=0;a<indices.length;a++){
for(let b=a+1;b<indices.length;b++){
const i=indices[a],j=indices[b];
const af=afinidadeCorredorV78(i,j,validos,resultado,orientacoes);
if(!af) continue;
adj.get(i).push({i:j,score:af.score});
adj.get(j).push({i:i,score:af.score});
}
}

// Componentes conectados. Depois dividimos componentes excessivamente largos
// para evitar o efeito corrente que juntaria um bairro inteiro.
const nao=new Set(indices),componentes=[];
while(nao.size){
const inicio=nao.values().next().value;
nao.delete(inicio);
const fila=[inicio],comp=[];
while(fila.length){
const atual=fila.shift();
comp.push(atual);
const viz=[...(adj.get(atual)||[])].sort((a,b)=>a.score-b.score);
for(const v of viz){
if(nao.has(v.i)){
nao.delete(v.i);
fila.push(v.i);
}
}
}
componentes.push(...dividirComponenteCorredorV78(comp,validos));
}

return componentes.map((membros,id)=>{
const angulo=anguloPcaScanner(membros,validos);
const ruas=[...new Set(membros.map(i=>chaveRuaGrupo(validos[i-1])))];
return {id,membros:[...membros],angulo,ruas};
});
}

function custoAproximadoEntreCorredoresV78(origem,destino,resultado,norm){
const origens=Array.isArray(origem)?origem:origem.membros;
const destinos=Array.isArray(destino)?destino:destino.membros;
return custoEntreConjuntosMatriz(origens,destinos,resultado,norm);
}

function gerarOrdensCorredoresBeamV78(corredores,resultado,norm,indiceDestinoFinal){
if(corredores.length<=1) return [{nome:'corredor-unico',ordem:[...corredores]}];
const porId=new Map(corredores.map(c=>[c.id,c]));
let estados=[{ordem:[],restantes:corredores.map(c=>c.id),atual:[0],custo:0}];

for(let passo=0;passo<corredores.length;passo++){
const proximos=[];
for(const estado of estados){
const escolhas=estado.restantes.map(id=>{
const c=porId.get(id);
return {id,custo:custoAproximadoEntreCorredoresV78(estado.atual,c,resultado,norm)};
}).sort((a,b)=>a.custo-b.custo)
.slice(0,Math.min(BEAM_CORREDORES_RAMIFICACAO,estado.restantes.length));

for(const escolha of escolhas){
const c=porId.get(escolha.id);
const restantes=estado.restantes.filter(id=>id!==escolha.id);
let custo=estado.custo+(Number.isFinite(escolha.custo)?escolha.custo:9999);

// Quando este for o último corredor, já considera o custo aproximado até o
// destino final escolhido pelo usuário.
if(restantes.length===0&&Number.isInteger(indiceDestinoFinal)){
const saida=custoAproximadoEntreCorredoresV78(c.membros,[indiceDestinoFinal],resultado,norm);
if(Number.isFinite(saida)) custo+=saida;
}

proximos.push({ordem:[...estado.ordem,escolha.id],restantes,atual:c.membros,custo});
}
}
proximos.sort((a,b)=>a.custo-b.custo);
estados=proximos.slice(0,BEAM_CORREDORES_LARGURA);
}

const saida=[],vistas=new Set();
for(const estado of estados.slice(0,12)){
const ordem=estado.ordem.map(id=>porId.get(id));
const sig=estado.ordem.join('>');
if(!vistas.has(sig)){
vistas.add(sig);
saida.push({nome:'beam-corredores',ordem});
}
}

// Segurança: inclui também um greedy simples a partir do GPS.
const greedy=ordemZonasScannerVizinho(corredores,resultado,norm,null);
const sigG=greedy.map(c=>c.id).join('>');
if(sigG&&!vistas.has(sigG)) saida.push({nome:'greedy-corredores',ordem:greedy});
return saida;
}

function metricasSequenciaLocalV78(indices,atual,alvosSaida,resultado){
let tempo=0,dist=0,ant=atual;
for(const idx of indices){
const t=valorMatriz(resultado.duracoes,ant,idx);
const d=valorMatriz(resultado.distancias,ant,idx);
if(!Number.isFinite(t)||!Number.isFinite(d)) return {tempo:Infinity,dist:Infinity};
tempo+=t;dist+=d;ant=idx;
}
if(alvosSaida&&alvosSaida.length){
let melhorT=Infinity,melhorD=Infinity;
for(const alvo of alvosSaida){
const t=valorMatriz(resultado.duracoes,ant,alvo);
const d=valorMatriz(resultado.distancias,ant,alvo);
if(Number.isFinite(t)&&t<melhorT){melhorT=t;melhorD=Number.isFinite(d)?d:melhorD;}
}
if(Number.isFinite(melhorT)){tempo+=melhorT;if(Number.isFinite(melhorD))dist+=melhorD;}
}
return {tempo,dist};
}

function gerarSequenciasCorredorV78(corredor,atual,alvosSaida,resultado,norm,validos){
const membros=[...corredor.membros];
if(membros.length<=1) return [membros];
const candidatas=[],vistas=new Set();
function add(seq){
if(!seq||seq.length!==membros.length) return;
const sig=seq.join('>');
if(!vistas.has(sig)){vistas.add(sig);candidatas.push(seq);}
}

// 1) Ao longo do eixo principal do corredor (ida e volta).
const proj=projecoesEixoCorredorV78(membros,validos,corredor.angulo);
const eixo=[...proj].sort((a,b)=>a.s-b.s).map(x=>x.i);
add(eixo);add([...eixo].reverse());

// 2) Vizinho por tempo direcional, partindo da entrada real no corredor.
let rest=[...membros],cur=atual,greedy=[];
while(rest.length){
let p=0,melhor=Infinity;
rest.forEach((idx,k)=>{
const t=valorMatriz(resultado.duracoes,cur,idx);
const d=valorMatriz(resultado.distancias,cur,idx);
const score=(Number.isFinite(t)?t:1e9)+(Number.isFinite(d)?d/25:1e9);
if(score<melhor){melhor=score;p=k;}
});
const x=rest.splice(p,1)[0];greedy.push(x);cur=x;
}
add(greedy);add([...greedy].reverse());

// 3) Continuidade por rua dentro do corredor.
const ruasMap=new Map();
membros.forEach(idx=>{
const k=chaveRuaGrupo(validos[idx-1]);
if(!ruasMap.has(k)) ruasMap.set(k,[]);
ruasMap.get(k).push(idx);
});
if(ruasMap.size>1){
let ruas=[...ruasMap.values()],seq=[],cur2=atual;
while(ruas.length){
let p=0,c=Infinity;
ruas.forEach((r,k)=>{const cc=custoEntreConjuntosMatriz([cur2],r,resultado,norm);if(cc<c){c=cc;p=k;}});
const rua=ruas.splice(p,1)[0];
const saida=ruas.flat().length?ruas.flat():alvosSaida;
const ord=candidatosOrdemRuaV75(rua,cur2,saida,resultado,norm,validos);
seq.push(...ord);cur2=ord[ord.length-1]??cur2;
}
add(seq);
}

// 4) Scanner local: útil em conjuntos de ruas paralelas, mas somente dentro
// deste corredor, para não voltar a impor uma serpentina ao bairro inteiro.
const scanner=melhorScannerDaZona(corredor,atual,alvosSaida,resultado,norm,validos);
add(scanner);

return candidatas;
}

function escolherSequenciaCorredorV78(corredor,atual,alvosSaida,resultado,norm,validos){
const candidatas=gerarSequenciasCorredorV78(corredor,atual,alvosSaida,resultado,norm,validos);
const avaliadas=candidatas.map(seq=>({seq,...metricasSequenciaLocalV78(seq,atual,alvosSaida,resultado)}))
.filter(x=>Number.isFinite(x.tempo)&&Number.isFinite(x.dist));
if(!avaliadas.length) return [...corredor.membros];
const menorTempo=Math.min(...avaliadas.map(x=>x.tempo));
const faixa=avaliadas.filter(x=>x.tempo<=menorTempo*1.03);
faixa.sort((a,b)=>a.dist-b.dist||a.tempo-b.tempo);
return [...faixa[0].seq];
}

function expandirCorredoresV78(ordemCorredores,validos,resultado,norm,indiceDestinoFinal){
const rota=[];
let atual=0;
for(let ci=0;ci<ordemCorredores.length;ci++){
const corredor=ordemCorredores[ci];
const saida=[];
if(ci<ordemCorredores.length-1) saida.push(...ordemCorredores[ci+1].membros);
else if(Number.isInteger(indiceDestinoFinal)) saida.push(indiceDestinoFinal);
const seq=escolherSequenciaCorredorV78(corredor,atual,saida,resultado,norm,validos);
rota.push(...seq);
atual=seq[seq.length-1]??atual;
}
return rota;
}

function penalidadeReentradaCorredorV78(ordem,corredores){
const mapa=new Map();
corredores.forEach(c=>c.membros.forEach(i=>mapa.set(i,c.id)));
let blocos=0,ultimo=null;
const vistos=new Set();
for(const idx of ordem){
const c=mapa.get(idx);
if(c!==ultimo){
if(vistos.has(c)) blocos++;
vistos.add(c);ultimo=c;
}
}
return blocos;
}

function gerarCandidatasCorredoresV78(validos,resultado,indiceDestinoFinal){
const norm=normalizadoresMatriz(resultado);
const corredores=clusterizarCorredoresV78(validos,resultado);
const ordens=gerarOrdensCorredoresBeamV78(corredores,resultado,norm,indiceDestinoFinal);
const candidatas=[],vistas=new Set();
for(const oc of ordens){
let ordemIndices=expandirCorredoresV78(oc.ordem,validos,resultado,norm,indiceDestinoFinal);
ordemIndices=repararJanelasHardV75(ordemIndices,resultado,validos);
const sig=ordemIndices.join('>');
if(sig&&!vistas.has(sig)){
vistas.add(sig);
candidatas.push({nome:'corredores-'+oc.nome,ordemIndices});
}
}
return {candidatas,corredores};
}

function escolherMelhorCorredoresV78(candidatas,resultado,indiceDestinoFinal,validos,corredores){
const avaliadas=candidatas.map(c=>{
const janelas=avaliarJanelasRotaV75(c.ordemIndices,resultado,validos);
const metricas=metricasOperacionaisMatrizV75(c.ordemIndices,resultado,indiceDestinoFinal,validos);
const reentradas=penalidadeReentradaCorredorV78(c.ordemIndices,corredores);
return {...c,janelas,metricas,reentradas};
});
const factiveis=avaliadas.filter(a=>a.janelas.violacoesHard.length===0&&metricasRotaValidas(a.metricas));
const base=factiveis.length?factiveis:avaliadas.filter(a=>metricasRotaValidas(a.metricas));
if(!base.length) return {melhor:null,avaliadas,referencia:null};
const referencia=referenciaEquilibrio(base);

// Mantém a filosofia da V7.7: tempo primeiro. Entre rotas até 3% do melhor
// tempo, escolhe a menor quilometragem. Reentrar num corredor já concluído
// é apenas desempate e nunca vence uma diferença relevante de tempo.
const menorTempo=Math.min(...base.map(a=>a.metricas.duracao));
const faixaTempo=base.filter(a=>a.metricas.duracao<=menorTempo*1.03);
let melhor=null;
for(const a of faixaTempo){
let score=a.metricas.distancia/Math.max(1,referencia.menorDistancia);
if(a.janelas.violacoesHard.length) score+=1000+a.janelas.atrasoHardMin*10;
score+=PESO_SOFT_SECUNDARIO*(a.janelas.penalidadeSoftMin/Math.max(1,a.metricas.duracao/60));
score+=a.reentradas*0.025;
if(!melhor||score<melhor.score-0.0001||(Math.abs(score-melhor.score)<=0.0001&&a.metricas.duracao<melhor.metricas.duracao)){
melhor={...a,score};
}
}
return {melhor,avaliadas,referencia};
}


// ----------------------------------------------------------------------
// V7.9 - SCANNER COMO REGRA PRINCIPAL
// ----------------------------------------------------------------------
/*
REGRA CENTRAL V7.9

O formato Scanner deixa de ser apenas uma alternativa geométrica e passa a
ser a estrutura obrigatória da rota. O objetivo é impedir o comportamento
"passar por uma área, deixar entregas para trás e voltar depois".

Hierarquia:
1) janelas HARD, quando existirem dados reais;
2) menor penalidade de varredura / menor quantidade de "passou e voltou";
3) entre scanners estruturalmente equivalentes, menor TEMPO pelas vias;
4) se o tempo for praticamente igual, menor quilometragem.

Os corredores da V7.8 permanecem no arquivo para rollback/estudo, mas não
comandam a rota nesta versão.
*/

const LARGURAS_FAIXA_SCANNER_V79 = [45, 60, 80, 105, 135, 170, 220];
const RAIO_PASSOU_PERTO_V79 = 125;
const RAIO_PARADA_PROXIMA_V79 = 155;
const SALTO_LONGO_V79 = 360;
const EXTRA_TEMPO_CAPTURA_V79 = 105;   // segundos extras máximos tolerados
const EXTRA_DIST_CAPTURA_V79 = 750;    // metros extras máximos tolerados

function angulosCandidatosScannerV79(indices,validos){
const base=angulosCandidatosScanner(indices,validos);
const saida=[];
const offsets=[0, 10, -10, 20, -20].map(g=>g*Math.PI/180);
base.forEach(a=>offsets.forEach(o=>{
const n=normalizarAnguloScanner(a+o);
if(!saida.some(x=>diferencaAngularScanner(x,n)<Math.PI/72)) saida.push(n);
}));
return saida;
}

function capturarParadasNoCaminhoScannerV79(ordemInicial,resultado,validos){
let ordem=[...ordemInicial];
if(ordem.length<3) return ordem;
const todos=[...ordem];
const {map}=coordsLocaisScanner(todos,validos);

for(let passada=0;passada<5;passada++){
let mudou=false;
for(let k=1;k<ordem.length;k++){
const aIdx=ordem[k-1],bIdx=ordem[k];
const a=map.get(aIdx),b=map.get(bIdx);
if(!a||!b) continue;

const tempoAB=valorMatriz(resultado.duracoes,aIdx,bIdx);
const distAB=valorMatriz(resultado.distancias,aIdx,bIdx);
if(!Number.isFinite(tempoAB)||!Number.isFinite(distAB)) continue;

let melhor=null;
for(let j=k+1;j<ordem.length;j++){
const pIdx=ordem[j],p=map.get(pIdx);
if(!p) continue;

const seg=distanciaPontoSegmentoMetrosScanner(p,a,b);
const pertoDoSegmento=seg.dist<=RAIO_PASSOU_PERTO_V79 && seg.t>=0.03 && seg.t<=0.98;
const distAtual=Math.hypot(p.x-a.x,p.y-a.y);
const distProx=Math.hypot(b.x-a.x,b.y-a.y);
const deixouVizinho=distAtual<=RAIO_PARADA_PROXIMA_V79 && distProx>=SALTO_LONGO_V79;
if(!pertoDoSegmento && !deixouVizinho) continue;

const t1=valorMatriz(resultado.duracoes,aIdx,pIdx);
const t2=valorMatriz(resultado.duracoes,pIdx,bIdx);
const d1=valorMatriz(resultado.distancias,aIdx,pIdx);
const d2=valorMatriz(resultado.distancias,pIdx,bIdx);
if(![t1,t2,d1,d2].every(Number.isFinite)) continue;

const extraTempo=(t1+t2)-tempoAB;
const extraDist=(d1+d2)-distAB;
const limiteTempo=Math.max(EXTRA_TEMPO_CAPTURA_V79,tempoAB*.45);
const limiteDist=Math.max(EXTRA_DIST_CAPTURA_V79,distAB*.55);
if(extraTempo>limiteTempo || extraDist>limiteDist) continue;

const chave=(pertoDoSegmento?seg.dist:distAtual) + Math.max(0,extraTempo)*.55 + Math.max(0,extraDist)/25;
if(!melhor || chave<melhor.chave) melhor={j,pIdx,chave};
}

if(melhor){
ordem.splice(melhor.j,1);
ordem.splice(k,0,melhor.pIdx);
mudou=true;
k++;
}
}
if(!mudou) break;
}
return ordem;
}

function penalidadePassouERetornouV79(ordem,validos){
if(ordem.length<3) return 0;
const {map}=coordsLocaisScanner(ordem,validos);
let penal=0;

for(let i=0;i<ordem.length-1;i++){
const aIdx=ordem[i],bIdx=ordem[i+1];
const a=map.get(aIdx),b=map.get(bIdx);
if(!a||!b) continue;
const salto=Math.hypot(b.x-a.x,b.y-a.y);

for(let j=i+2;j<ordem.length;j++){
const p=map.get(ordem[j]);
if(!p) continue;
const seg=distanciaPontoSegmentoMetrosScanner(p,a,b);
const da=Math.hypot(p.x-a.x,p.y-a.y);

// Passou praticamente ao lado de uma entrega e só foi atendê-la depois.
if(seg.dist<=RAIO_PASSOU_PERTO_V79 && seg.t>=0.04 && seg.t<=0.96){
const atraso=Math.min(8,j-i-1);
penal += (1-seg.dist/RAIO_PASSOU_PERTO_V79) * (1 + atraso*.16);
}

// Saiu de perto de uma entrega para fazer um salto grande e voltar depois.
if(da<=RAIO_PARADA_PROXIMA_V79 && salto>=SALTO_LONGO_V79){
penal += (1-da/RAIO_PARADA_PROXIMA_V79) * 1.4;
}
}
}
return penal;
}

function penalidadeSaltosScannerV79(ordem,validos){
if(ordem.length<3) return 0;
let penal=0;
const restantes=new Set(ordem);
for(let i=0;i<ordem.length-1;i++){
const atual=ordem[i],prox=ordem[i+1];
restantes.delete(atual);
const dProx=distanciaGeograficaIndices(atual,prox,validos);
let menor=Infinity;
for(const cand of restantes){
if(cand===prox) continue;
const d=distanciaGeograficaIndices(atual,cand,validos);
if(d<menor) menor=d;
}
if(Number.isFinite(menor)&&menor<210&&Number.isFinite(dProx)&&dProx>Math.max(380,menor*2.8)){
penal+=(dProx-menor)/450;
}
}
return penal;
}

function penalidadeEstruturalScannerV79(ordem,validos){
const passou=penalidadePassouERetornouV79(ordem,validos);
const saltos=penalidadeSaltosScannerV79(ordem,validos);
const continuidade=penalidadeContinuidadeScanner(ordem,validos);
return passou*4.5 + saltos*2.3 + continuidade*.8;
}

function gerarCandidatasScannerPrincipalV79(validos,resultado,indiceDestinoFinal){
const norm=normalizadoresMatriz(resultado);
const membros=validos.map((_,i)=>i+1);
const candidatas=[],vistas=new Set();
const destino=Number.isInteger(indiceDestinoFinal)?[indiceDestinoFinal]:[];

function add(nome,seq){
if(!seq || seq.length!==membros.length) return;
let capt=capturarParadasNoCaminhoScannerV79(seq,resultado,validos);
capt=repararJanelasHardV75(capt,resultado,validos);
const sig=capt.join('>');
if(!sig||vistas.has(sig)) return;
vistas.add(sig);
candidatas.push({nome,ordemIndices:capt});
}

// Scanner global: toda a rota participa da mesma varredura. Testamos várias
// orientações e larguras, mas todas obedecem ao padrão de faixas contínuas.
const angulos=angulosCandidatosScannerV79(membros,validos);
for(const angulo of angulos){
for(const largura of LARGURAS_FAIXA_SCANNER_V79){
const faixas=criarFaixasScannerZona(membros,validos,angulo,largura);
const ordens=ordensSerpentinaFaixas(faixas,0,destino,resultado,norm);
ordens.forEach((seq,k)=>add(`scanner-global-${Math.round(angulo*180/Math.PI)}-${largura}-${k+1}`,seq));
}
}

// Também aceitamos scanners por grandes zonas apenas como variantes de
// varredura. Eles continuam sujeitos à mesma penalidade estrutural global.
const legado=gerarCandidatasScannerV76(validos,resultado,indiceDestinoFinal);
(legado.candidatas||[]).forEach(c=>add('scanner-zonas-'+c.nome,c.ordemIndices));

return {candidatas};
}

function escolherMelhorScannerPrincipalV79(candidatas,resultado,indiceDestinoFinal,validos){
const avaliadas=candidatas.map(c=>{
const janelas=avaliarJanelasRotaV75(c.ordemIndices,resultado,validos);
const metricas=metricasOperacionaisMatrizV75(c.ordemIndices,resultado,indiceDestinoFinal,validos);
const estrutural=penalidadeEstruturalScannerV79(c.ordemIndices,validos);
return {...c,janelas,metricas,estrutural};
});

const factiveis=avaliadas.filter(a=>a.janelas.violacoesHard.length===0&&metricasRotaValidas(a.metricas));
const base=factiveis.length?factiveis:avaliadas.filter(a=>metricasRotaValidas(a.metricas));
if(!base.length) return {melhor:null,avaliadas};

// Scanner é a prioridade: primeiro eliminamos as rotas que passam e voltam.
// Só depois comparamos tempo e, por último, quilômetros.
const menorEstrutural=Math.min(...base.map(a=>a.estrutural));
const toleranciaEstrutural=Math.max(.30,menorEstrutural*.12);
const scannersValidos=base.filter(a=>a.estrutural<=menorEstrutural+toleranciaEstrutural);

const menorTempo=Math.min(...scannersValidos.map(a=>a.metricas.duracao));
const faixaTempo=scannersValidos.filter(a=>a.metricas.duracao<=menorTempo*1.025);
faixaTempo.sort((a,b)=>
 a.metricas.distancia-b.metricas.distancia ||
 a.metricas.duracao-b.metricas.duracao ||
 a.estrutural-b.estrutural
);
return {melhor:faixaTempo[0]||null,avaliadas};
}



// ----------------------------------------------------------------------
// V7.10 - SCANNER POR FRONTEIRA + CHECAGEM DO CAMINHO REAL
// ----------------------------------------------------------------------
/*
REFERÊNCIA APRENDIDA COM O TRAÇADO MANUAL DO USUÁRIO

O traçado manual mostrou que uma rota operacionalmente boa tem uma "frente"
contínua de varredura. Ela não escolhe apenas o próximo ponto barato:
- fecha a área/corredor em que já entrou antes de abandonar a região;
- evita cruzar a própria rota e reentrar em células já atendidas;
- evita saltar por cima de entregas que estão literalmente no caminho;
- aceita um pequeno custo local quando isso elimina uma volta grande depois;
- usa início e destino final como âncoras do movimento global;
- janelas HARD continuam acima de qualquer regra geométrica;
- depois da estrutura, TEMPO é prioridade e KM é desempate.

A implementação abaixo NÃO copia uma sequência específica. Ela transforma
esse comportamento em regras gerais para qualquer rota.
*/

const V710_BEAM_LARGURA = 30;
const V710_BEAM_RAMIFICACAO = 8;
const V710_RAIO_LOCAL = 240;
const V710_RAIO_PASSAGEM_RETA = 95;
const V710_SALTO_SAIDA_AREA = 420;
const V710_CELULA = 300;
const V710_RAIO_PASSAGEM_VIA_REAL = 55;

function contextoGeometricoV710(validos,inicio,destino,indiceDestinoFinal){
const refs=[];
if(inicio&&pontoValido(inicio)) refs.push({i:0,lat:Number(inicio.lat),lng:Number(inicio.lng)});
validos.forEach((g,k)=>refs.push({i:k+1,lat:Number(g.lat),lng:Number(g.lng)}));
if(Number.isInteger(indiceDestinoFinal)&&destino&&pontoValido(destino)) refs.push({i:indiceDestinoFinal,lat:Number(destino.lat),lng:Number(destino.lng)});
let refLat=0,refLng=0;
refs.forEach(p=>{refLat+=p.lat;refLng+=p.lng;});
refLat/=Math.max(1,refs.length);refLng/=Math.max(1,refs.length);
const cos=Math.cos(refLat*Math.PI/180);
const map=new Map();
refs.forEach(p=>map.set(p.i,{x:(p.lng-refLng)*111320*cos,y:(p.lat-refLat)*111320,lat:p.lat,lng:p.lng}));

// Eixo principal apenas para organizar células. A decisão da rota não fica
// presa a esse eixo; ele serve para detectar reentrada em áreas já varridas.
const membros=validos.map((_,i)=>i+1);
let angulo=anguloPcaScanner(membros,validos);
if(destino&&pontoValido(destino)&&inicio&&pontoValido(inicio)){
const a=map.get(0),b=map.get(indiceDestinoFinal);
if(a&&b&&Math.hypot(b.x-a.x,b.y-a.y)>300) angulo=normalizarAnguloScanner(Math.atan2(b.y-a.y,b.x-a.x));
}
return {map,angulo};
}

function chaveCelulaV710(indice,ctx){
const p=ctx.map.get(indice);if(!p) return 'x';
const ca=Math.cos(ctx.angulo),sa=Math.sin(ctx.angulo);
const s=p.x*ca+p.y*sa,t=-p.x*sa+p.y*ca;
return Math.floor(s/V710_CELULA)+':'+Math.floor(t/V710_CELULA);
}

function orientacaoTriplaV710(a,b,c,ctx){
const A=ctx.map.get(a),B=ctx.map.get(b),C=ctx.map.get(c);
if(!A||!B||!C) return 0;
const ux=B.x-A.x,uy=B.y-A.y,vx=C.x-B.x,vy=C.y-B.y;
const nu=Math.hypot(ux,uy),nv=Math.hypot(vx,vy);
if(nu<1||nv<1) return 0;
const dot=Math.max(-1,Math.min(1,(ux*vx+uy*vy)/(nu*nv)));
return Math.acos(dot); // 0 = reto; PI = retorno
}

function segmentosCruzamV710(a,b,c,d){
function ori(p,q,r){return (q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);}
const o1=ori(a,b,c),o2=ori(a,b,d),o3=ori(c,d,a),o4=ori(c,d,b);
return ((o1>0&&o2<0)||(o1<0&&o2>0))&&((o3>0&&o4<0)||(o3<0&&o4>0));
}

function cruzamentosNovoTrechoV710(rota,candidato,ctx){
const caminho=[0,...rota];
if(caminho.length<3) return 0;
const atual=caminho[caminho.length-1];
const A=ctx.map.get(atual),B=ctx.map.get(candidato);
if(!A||!B) return 0;
let n=0;
// Não compara com o último segmento, pois compartilha o vértice atual.
for(let i=1;i<caminho.length-1;i++){
const C=ctx.map.get(caminho[i-1]),D=ctx.map.get(caminho[i]);
if(C&&D&&segmentosCruzamV710(A,B,C,D)) n++;
}
return n;
}

function distanciaGeoContextoV710(a,b,ctx){
const A=ctx.map.get(a),B=ctx.map.get(b);
return A&&B?Math.hypot(A.x-B.x,A.y-B.y):Infinity;
}

function distanciaPontoSegmentoCtxV710(p,a,b){
const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y;
const vv=vx*vx+vy*vy;
const t=vv>0?Math.max(0,Math.min(1,(wx*vx+wy*vy)/vv)):0;
const qx=a.x+t*vx,qy=a.y+t*vy;
return {dist:Math.hypot(p.x-qx,p.y-qy),t};
}

function incrementoEstruturalV710(estado,cand,resultado,norm,ctx,indiceDestinoFinal){
const atual=estado.atual;
const A=ctx.map.get(atual),B=ctx.map.get(cand);
if(!A||!B) return 0;
let penal=0;
const distCand=Math.hypot(B.x-A.x,B.y-A.y);

// 1) Não abandonar a frente local quando ainda existem entregas acessíveis.
let melhorLocal=Infinity;
let locais=0;
for(const r of estado.restantes){
if(r===cand) continue;
const geo=distanciaGeoContextoV710(atual,r,ctx);
const t=valorMatriz(resultado.duracoes,atual,r);
if(geo<=V710_RAIO_LOCAL && Number.isFinite(t) && t<=300){
locais++; if(geo<melhorLocal) melhorLocal=geo;
}
}
if(locais>0 && distCand>V710_SALTO_SAIDA_AREA){
penal += 5 + Math.min(5,distCand/350);
}

// 2) Se o novo trecho passa praticamente por cima de outra entrega futura,
// deixar essa entrega para depois recebe uma penalidade forte.
for(const r of estado.restantes){
if(r===cand) continue;
const P=ctx.map.get(r);if(!P) continue;
const seg=distanciaPontoSegmentoCtxV710(P,A,B);
if(seg.dist<=V710_RAIO_PASSAGEM_RETA && seg.t>=.05 && seg.t<=.96){
penal += 3.4*(1-seg.dist/V710_RAIO_PASSAGEM_RETA);
}
}

// 3) Cruzar a própria rota é um forte sinal de reentrada/zigue-zague.
penal += cruzamentosNovoTrechoV710(estado.rota,cand,ctx)*7.5;

// 4) Retornos bruscos são permitidos em cul-de-sac, mas custam caro.
if(estado.rota.length>=1){
const anterior=estado.rota.length>=2?estado.rota[estado.rota.length-2]:0;
const ang=orientacaoTriplaV710(anterior,atual,cand,ctx);
if(ang>2.45) penal += (ang-2.45)*1.6; // ~140 graus
}

// 5) Reentrar numa célula já abandonada indica que a varredura não fechou.
const cel=chaveCelulaV710(cand,ctx);
const celAtual=chaveCelulaV710(atual,ctx);
if(cel!==celAtual && estado.celulas.has(cel)) penal += 2.7;

// 6) Com destino final fixo, evita chegar muito perto dele cedo e sair de novo.
if(Number.isInteger(indiceDestinoFinal) && estado.restantes.length>Math.max(4,Math.floor((estado.total||1)*.30))){
const td=valorMatriz(resultado.duracoes,cand,indiceDestinoFinal);
const tempos=estado.restantes.filter(x=>x!==cand).map(x=>valorMatriz(resultado.duracoes,x,indiceDestinoFinal)).filter(Number.isFinite).sort((a,b)=>a-b);
if(Number.isFinite(td)&&tempos.length){
const q=Math.max(0,Math.floor(tempos.length*.20)-1);
if(td<=tempos[q]) penal+=1.4;
}
}
return penal;
}

function poolCandidatosV710(estado,resultado,norm,ctx){
const infos=estado.restantes.map(i=>{
const t=valorMatriz(resultado.duracoes,estado.atual,i);
const d=valorMatriz(resultado.distancias,estado.atual,i);
const geo=distanciaGeoContextoV710(estado.atual,i,ctx);
const score=(Number.isFinite(t)?t/norm.tempo:999)+(Number.isFinite(d)?.10*d/norm.distancia:99)+Math.min(2,geo/2500);
return {i,t,d,geo,score};
}).filter(x=>Number.isFinite(x.t)&&Number.isFinite(x.d));
infos.sort((a,b)=>a.score-b.score);
const ids=new Set(infos.slice(0,V710_BEAM_RAMIFICACAO).map(x=>x.i));
// Entregas locais sempre entram no conjunto de decisão, mesmo que o tempo
// instantâneo pareça um pouco pior por causa de mão única/retorno.
infos.filter(x=>x.geo<=V710_RAIO_LOCAL).slice(0,6).forEach(x=>ids.add(x.i));
return [...ids].slice(0,V710_BEAM_RAMIFICACAO+4);
}

function construirFronteiraV710(validos,resultado,indiceDestinoFinal,inicio,destino,config){
const norm=normalizadoresMatriz(resultado);
const ctx=contextoGeometricoV710(validos,inicio,destino,indiceDestinoFinal);
const todos=validos.map((_,i)=>i+1);
let estados=[{rota:[],restantes:[...todos],atual:0,estrutural:0,tempo:0,dist:0,celulas:new Set(),total:todos.length,rank:0}];

for(let profundidade=0;profundidade<todos.length;profundidade++){
const exp=[];
for(const estado of estados){
const pool=poolCandidatosV710(estado,resultado,norm,ctx);
for(const cand of pool){
const t=valorMatriz(resultado.duracoes,estado.atual,cand);
const d=valorMatriz(resultado.distancias,estado.atual,cand);
if(!Number.isFinite(t)||!Number.isFinite(d)) continue;
const inc=incrementoEstruturalV710(estado,cand,resultado,norm,ctx,indiceDestinoFinal)*(config?.rigor??1);
const restantes=estado.restantes.filter(x=>x!==cand);
const rota=[...estado.rota,cand];
const celulas=new Set(estado.celulas);celulas.add(chaveCelulaV710(cand,ctx));
const estrutural=estado.estrutural+inc;
const tempo=estado.tempo+t,dist=estado.dist+d;
let look=0;
if(restantes.length){
let melhor=Infinity;
for(const r of restantes){const x=valorMatriz(resultado.duracoes,cand,r);if(x<melhor) melhor=x;}
if(Number.isFinite(melhor)) look=melhor/norm.tempo;
}else if(Number.isInteger(indiceDestinoFinal)){
const x=valorMatriz(resultado.duracoes,cand,indiceDestinoFinal);if(Number.isFinite(x)) look=x/norm.tempo;
}
const rank=estrutural*100 + tempo/norm.tempo + .10*dist/norm.distancia + .22*look;
exp.push({rota,restantes,atual:cand,estrutural,tempo,dist,celulas,total:estado.total,rank});
}
}
if(!exp.length) break;
exp.sort((a,b)=>a.rank-b.rank || a.tempo-b.tempo || a.dist-b.dist);
// Remove estados equivalentes grosseiros (mesmo último ponto + mesmo conjunto
// restante) para gastar o beam com caminhos realmente diferentes.
const unicos=[],vistas=new Set();
for(const e of exp){
const sig=e.atual+'|'+e.restantes.join(',');
if(vistas.has(sig)) continue;
vistas.add(sig);unicos.push(e);
if(unicos.length>=V710_BEAM_LARGURA) break;
}
estados=unicos;
}

const completos=estados.filter(e=>e.rota.length===todos.length);
if(!completos.length) return null;
completos.forEach(e=>{
if(Number.isInteger(indiceDestinoFinal)){
const t=valorMatriz(resultado.duracoes,e.atual,indiceDestinoFinal);
const d=valorMatriz(resultado.distancias,e.atual,indiceDestinoFinal);
if(Number.isFinite(t)) e.tempo+=t;if(Number.isFinite(d)) e.dist+=d;
}
e.rank=e.estrutural*100+e.tempo/norm.tempo+.10*e.dist/norm.distancia;
});
completos.sort((a,b)=>a.rank-b.rank||a.tempo-b.tempo||a.dist-b.dist);
return completos[0].rota;
}

function penalidadeCruzamentosV710(ordem,validos,inicio,destino,indiceDestinoFinal){
const ctx=contextoGeometricoV710(validos,inicio,destino,indiceDestinoFinal);
const caminho=[0,...ordem];
let n=0;
for(let i=1;i<caminho.length;i++){
const A=ctx.map.get(caminho[i-1]),B=ctx.map.get(caminho[i]);if(!A||!B) continue;
for(let j=1;j<i-1;j++){
const C=ctx.map.get(caminho[j-1]),D=ctx.map.get(caminho[j]);
if(C&&D&&segmentosCruzamV710(A,B,C,D)) n++;
}
}
return n;
}

function penalidadeReentradaCelulasV710(ordem,validos,inicio,destino,indiceDestinoFinal){
const ctx=contextoGeometricoV710(validos,inicio,destino,indiceDestinoFinal);
const vistas=new Set();let atual=chaveCelulaV710(0,ctx),penal=0;
if(atual!=='x') vistas.add(atual);
for(const idx of ordem){
const c=chaveCelulaV710(idx,ctx);
if(c!==atual){if(vistas.has(c)) penal+=1;vistas.add(c);atual=c;}
}
return penal;
}

function penalidadeRetornosV710(ordem,validos,inicio,destino,indiceDestinoFinal){
const ctx=contextoGeometricoV710(validos,inicio,destino,indiceDestinoFinal);
const caminho=[0,...ordem];let p=0;
for(let i=2;i<caminho.length;i++){
const a=orientacaoTriplaV710(caminho[i-2],caminho[i-1],caminho[i],ctx);
if(a>2.55) p+=(a-2.55);
}
return p;
}

function penalidadeEstruturalScannerV710(ordem,validos,inicio,destino,indiceDestinoFinal){
return penalidadeEstruturalScannerV79(ordem,validos)
+ penalidadeCruzamentosV710(ordem,validos,inicio,destino,indiceDestinoFinal)*5.5
+ penalidadeReentradaCelulasV710(ordem,validos,inicio,destino,indiceDestinoFinal)*2.8
+ penalidadeRetornosV710(ordem,validos,inicio,destino,indiceDestinoFinal)*1.2;
}

function gerarCandidatasScannerAprendidoV710(validos,resultado,indiceDestinoFinal,inicio,destino){
const candidatas=[],vistas=new Set();
function add(nome,seq){
if(!seq||seq.length!==validos.length) return;
let s=capturarParadasNoCaminhoScannerV79(seq,resultado,validos);
s=repararJanelasHardV75(s,resultado,validos);
const sig=s.join('>');if(!sig||vistas.has(sig)) return;
vistas.add(sig);candidatas.push({nome,ordemIndices:s});
}

// Mantém os scanners geométricos da V7.9 como alternativas válidas.
const antigas=gerarCandidatasScannerPrincipalV79(validos,resultado,indiceDestinoFinal);
(antigas.candidatas||[]).forEach(c=>add('scanner-v79-'+c.nome,c.ordemIndices));

// Duas variações de "fronteira" aprendidas com o traçado manual. A rígida
// fecha mais a área; a flexível permite que a matriz viária quebre a frente
// quando há ganho real de tempo.
const estrita=construirFronteiraV710(validos,resultado,indiceDestinoFinal,inicio,destino,{rigor:1.20});
const flexivel=construirFronteiraV710(validos,resultado,indiceDestinoFinal,inicio,destino,{rigor:.88});
add('fronteira-estrita',estrita);
add('fronteira-flexivel',flexivel);
return {candidatas};
}

function escolherMelhorScannerAprendidoV710(candidatas,resultado,indiceDestinoFinal,validos,inicio,destino){
const avaliadas=candidatas.map(c=>{
const janelas=avaliarJanelasRotaV75(c.ordemIndices,resultado,validos);
const metricas=metricasOperacionaisMatrizV75(c.ordemIndices,resultado,indiceDestinoFinal,validos);
const estrutural=penalidadeEstruturalScannerV710(c.ordemIndices,validos,inicio,destino,indiceDestinoFinal);
return {...c,janelas,metricas,estrutural};
});
const factiveis=avaliadas.filter(a=>a.janelas.violacoesHard.length===0&&metricasRotaValidas(a.metricas));
const base=factiveis.length?factiveis:avaliadas.filter(a=>metricasRotaValidas(a.metricas));
if(!base.length) return {melhor:null,avaliadas};

// A estrutura aprendida vem primeiro. Entre rotas estruturalmente parecidas,
// tempo decide. Quilometragem decide o empate final.
const minEstr=Math.min(...base.map(a=>a.estrutural));
const tol=Math.max(.22,minEstr*.07);
const boas=base.filter(a=>a.estrutural<=minEstr+tol);
const minTempo=Math.min(...boas.map(a=>a.metricas.duracao));
const rapidas=boas.filter(a=>a.metricas.duracao<=minTempo*1.03);
rapidas.sort((a,b)=>a.metricas.distancia-b.metricas.distancia || a.metricas.duracao-b.metricas.duracao || a.estrutural-b.estrutural);
return {melhor:rapidas[0]||null,avaliadas};
}

async function consultarPernasRotaOSRMV710(ordem,inicio,destino){
const pontos=[inicio,...ordem.map(pontoGrupo)];if(destino) pontos.push(destino);
const pernas=[];const MAX=28;
for(let base=0;base<pontos.length-1;base+=MAX-1){
const parte=pontos.slice(base,Math.min(pontos.length,base+MAX));
if(parte.length<2) break;
const url=`https://router.project-osrm.org/route/v1/driving/${stringCoordenadas(parte)}?overview=false&steps=true&geometries=geojson`;
const r=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!r.ok) throw new Error('OSRM_GEOM_'+r.status);
const d=await r.json();const rota=d.routes&&d.routes[0];if(!rota||!Array.isArray(rota.legs)) throw new Error('OSRM_GEOM_INVALIDA');
for(const leg of rota.legs){
const coords=[];
for(const st of (leg.steps||[])){
const arr=st.geometry&&st.geometry.coordinates;
if(Array.isArray(arr)) arr.forEach(c=>{if(Array.isArray(c)&&c.length>=2) coords.push({lat:Number(c[1]),lng:Number(c[0])});});
}
pernas.push(coords);
}
if(base+MAX-1<pontos.length-1) await esperar(120);
}
return pernas;
}

function distanciaPontoPolilinhaV710(ponto,linha){
if(!ponto||!Array.isArray(linha)||linha.length<2) return Infinity;
const lat=Number(ponto.lat),lng=Number(ponto.lng),cos=Math.cos(lat*Math.PI/180);
let melhor=Infinity;
for(let i=1;i<linha.length;i++){
const a=linha[i-1],b=linha[i];
const A={x:(a.lng-lng)*111320*cos,y:(a.lat-lat)*111320};
const B={x:(b.lng-lng)*111320*cos,y:(b.lat-lat)*111320};
const P={x:0,y:0};
const x=distanciaPontoSegmentoCtxV710(P,A,B).dist;if(x<melhor) melhor=x;
}
return melhor;
}

async function repararPassagensReaisV710(ordemInicial,inicio,destino,resultado,validos,indiceDestinoFinal){
let ordem=[...ordemInicial];
const idIndice=new Map(validos.map((g,i)=>[g.id,i+1]));
for(let passada=0;passada<3;passada++){
let pernas;
try{pernas=await consultarPernasRotaOSRMV710(ordem,inicio,destino);}catch(e){console.warn('Checagem de caminho real indisponível:',e);break;}
let melhorMov=null;
// Perna 0 = início -> ordem[0]; perna k = ordem[k-1] -> ordem[k].
for(let k=0;k<Math.min(pernas.length,ordem.length);k++){
const origemIdx=k===0?0:idIndice.get(ordem[k-1].id);
const destinoIdx=idIndice.get(ordem[k].id);
if(!Number.isInteger(destinoIdx)) continue;
const tAB=valorMatriz(resultado.duracoes,origemIdx,destinoIdx);
const dAB=valorMatriz(resultado.distancias,origemIdx,destinoIdx);
if(!Number.isFinite(tAB)||!Number.isFinite(dAB)) continue;
for(let j=k+1;j<ordem.length;j++){
const cand=ordem[j];const perto=distanciaPontoPolilinhaV710(cand,pernas[k]);
if(perto>V710_RAIO_PASSAGEM_VIA_REAL) continue;
const ci=idIndice.get(cand.id);if(!Number.isInteger(ci)) continue;
const t1=valorMatriz(resultado.duracoes,origemIdx,ci),t2=valorMatriz(resultado.duracoes,ci,destinoIdx);
const d1=valorMatriz(resultado.distancias,origemIdx,ci),d2=valorMatriz(resultado.distancias,ci,destinoIdx);
if(![t1,t2,d1,d2].every(Number.isFinite)) continue;
const extraT=t1+t2-tAB,extraD=d1+d2-dAB;
if(extraT>Math.max(85,tAB*.38)||extraD>Math.max(500,dAB*.40)) continue;
const score=perto+Math.max(0,extraT)*.55+Math.max(0,extraD)/22;
if(!melhorMov||score<melhorMov.score) melhorMov={de:j,para:k,score};
}
}
if(!melhorMov) break;
const [g]=ordem.splice(melhorMov.de,1);ordem.splice(melhorMov.para,0,g);
}
// A checagem real só move entregas para MAIS CEDO. Mesmo assim, reaplica
// eventual janela hard antes de devolver a ordem.
let indices=ordem.map(g=>idIndice.get(g.id)).filter(Number.isInteger);
indices=repararJanelasHardV75(indices,resultado,validos);
return indices.map(i=>validos[i-1]);
}

async function consultarTrechoDirectionsOSRM(pontos){
const coords = stringCoordenadas(pontos);
const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=false&steps=false`;
const resposta = await fetch(url,{signal:AbortSignal.timeout(25000)});
if(!resposta.ok) throw new Error('OSRM_ROUTE_' + resposta.status);
const dados = await resposta.json();
if(!dados.routes || !dados.routes[0]) throw new Error('OSRM_ROUTE_INVALIDA');
return {duracao:dados.routes[0].duration, distancia:dados.routes[0].distance};
}

async function calcularMetricasRota(ordem, inicio, destino){
const caminho = [inicio, ...ordem.map(pontoGrupo)];
if(destino) caminho.push(destino);
if(caminho.length < 2) return {duracao:null, distancia:null, provedor:null};

try{
let duracao = 0;
let distancia = 0;
for(let i=0;i<caminho.length-1;){
const trecho = caminho.slice(i, Math.min(i+40, caminho.length));
if(trecho.length < 2) break;
const r = await consultarTrechoDirectionsOSRM(trecho);
duracao += r.duracao;
distancia += r.distancia;
i += trecho.length - 1;
if(i < caminho.length-1) await esperar(120);
}
return {duracao, distancia, provedor:'OSRM'};
}catch(erro){
console.warn('Falha ao calcular métricas da rota:', erro);
return {duracao:null, distancia:null, provedor:null};
}
}

function metricasRotaValidas(m){
return m && Number.isFinite(m.duracao) && m.duracao > 0 && Number.isFinite(m.distancia) && m.distancia > 0;
}

function referenciaEquilibrio(avaliacoes){
const validas = avaliacoes.filter(a=>metricasRotaValidas(a.metricas));
if(!validas.length) return null;
return {
menorTempo:Math.min(...validas.map(a=>a.metricas.duracao)),
menorDistancia:Math.min(...validas.map(a=>a.metricas.distancia))
};
}

function pontuacaoEquilibrada(metricas, referencia){
if(!metricasRotaValidas(metricas) || !referencia) return Infinity;
const tempoRel = metricas.duracao / Math.max(1, referencia.menorTempo);
const distanciaRel = metricas.distancia / Math.max(1, referencia.menorDistancia);

// V7.7: prioridade explícita para tempo. A distância serve para desempatar
// e evitar quilômetros inúteis quando duas rotas têm tempos parecidos.
return 0.90 * tempoRel + 0.10 * distanciaRel;
}

async function avaliarCandidatasPelasVias(candidatas, inicio, destino){
const avaliacoes = [];
for(let i=0;i<candidatas.length;i++){
atualizarProgressoOtimizacao('Comparando caminhos possíveis pelas vias...');
const cand = candidatas[i];
const metricas = await calcularMetricasRota(cand.ordem, inicio, destino);
avaliacoes.push({...cand, metricas});
if(i < candidatas.length-1) await esperar(100);
}
return avaliacoes;
}

function escolherMelhorAvaliacao(avaliacoes, referencia){
let melhor = null;
for(const avaliacao of avaliacoes){
const score = pontuacaoEquilibrada(avaliacao.metricas, referencia);
if(!Number.isFinite(score)) continue;
if(!melhor || score < melhor.score - 0.0001){
melhor = {...avaliacao, score};
}else if(melhor && Math.abs(score - melhor.score) <= 0.0001){
// Empate praticamente perfeito: menor quilometragem reduz combustível.
if(avaliacao.metricas.distancia < melhor.metricas.distancia){
melhor = {...avaliacao, score};
}
}
}
return melhor;
}


// ----------------------------------------------------------------------
// V7.11 - OTIMIZAÇÃO HUMANA / BASELINE-FIRST
// ----------------------------------------------------------------------
/*
PRINCÍPIO V7.11

O erro das versões anteriores foi permitir que Scanner, clustering e regras
geométricas fossem capazes de vencer uma rota que, pelas próprias métricas
viárias, era pior que a ordem original.

A V7.11 trabalha como um motorista experiente:
1) a ordem original é a BASELINE que precisa ser superada;
2) Scanner/Fronteira/heurísticas só GERAM ideias de rota;
3) cada ideia é refinada globalmente, podendo mover qualquer parada;
4) tempo pelas vias é o critério primário e absoluto;
5) quilômetros só decidem quando os tempos são praticamente iguais;
6) se nenhuma alternativa superar a rota original, MANTÉM A ORDEM ORIGINAL.

Assim, uma rota nunca mais é chamada de "otimizada" quando aumenta o tempo.
*/

const V711_TOL_TEMPO_SEG = 2;
const V711_TOL_DIST_METROS = 5;

function compararMetricasV711(a,b){
if(!metricasRotaValidas(a)) return metricasRotaValidas(b) ? 1 : 0;
if(!metricasRotaValidas(b)) return -1;
if(a.duracao < b.duracao - V711_TOL_TEMPO_SEG) return -1;
if(a.duracao > b.duracao + V711_TOL_TEMPO_SEG) return 1;
if(a.distancia < b.distancia - V711_TOL_DIST_METROS) return -1;
if(a.distancia > b.distancia + V711_TOL_DIST_METROS) return 1;
return 0;
}

function rotaVizinhoTempoV711(indices,resultado){
const restantes=new Set(indices);
const ordem=[];
let atual=0;
while(restantes.size){
let melhor=null,melhorT=Infinity,melhorD=Infinity;
for(const c of restantes){
const t=valorMatriz(resultado.duracoes,atual,c);
const d=valorMatriz(resultado.distancias,atual,c);
if(!Number.isFinite(t)||!Number.isFinite(d)) continue;
if(t<melhorT-V711_TOL_TEMPO_SEG || (Math.abs(t-melhorT)<=V711_TOL_TEMPO_SEG && d<melhorD)){
melhor=c;melhorT=t;melhorD=d;
}
}
if(melhor===null){for(const c of restantes) ordem.push(c);break;}
ordem.push(melhor);restantes.delete(melhor);atual=melhor;
}
return ordem;
}

function rotaInsercaoTempoV711(indices,resultado,indiceDestinoFinal){
const restantes=new Set(indices),rota=[];
while(restantes.size){
let melhor=null;
for(const c of restantes){
for(let pos=0;pos<=rota.length;pos++){
const prev=pos===0?0:rota[pos-1];
const next=pos<rota.length?rota[pos]:(Number.isInteger(indiceDestinoFinal)?indiceDestinoFinal:null);
const tPC=valorMatriz(resultado.duracoes,prev,c),dPC=valorMatriz(resultado.distancias,prev,c);
if(!Number.isFinite(tPC)||!Number.isFinite(dPC)) continue;
let deltaT=tPC,deltaD=dPC;
if(next!==null){
const tCN=valorMatriz(resultado.duracoes,c,next),dCN=valorMatriz(resultado.distancias,c,next);
const tPN=valorMatriz(resultado.duracoes,prev,next),dPN=valorMatriz(resultado.distancias,prev,next);
if(![tCN,dCN,tPN,dPN].every(Number.isFinite)) continue;
deltaT += tCN-tPN; deltaD += dCN-dPN;
}
if(!melhor || deltaT<melhor.deltaT-V711_TOL_TEMPO_SEG ||
   (Math.abs(deltaT-melhor.deltaT)<=V711_TOL_TEMPO_SEG && deltaD<melhor.deltaD)){
melhor={c,pos,deltaT,deltaD};
}
}
}
if(!melhor){for(const c of restantes) rota.push(c);break;}
rota.splice(melhor.pos,0,melhor.c);restantes.delete(melhor.c);
}
return rota;
}

function deltaRealocacaoV711(ordem,i,pos,resultado,indiceDestinoFinal){
const x=ordem[i];
const reduzida=[...ordem.slice(0,i),...ordem.slice(i+1)];
const p=Math.max(0,Math.min(pos,reduzida.length));
if(p===i) return null;
function edge(a,b){
if(b===null) return {t:0,d:0};
const t=valorMatriz(resultado.duracoes,a,b),d=valorMatriz(resultado.distancias,a,b);
return Number.isFinite(t)&&Number.isFinite(d)?{t,d}:null;
}
const prevR=i===0?0:ordem[i-1];
const nextR=i===ordem.length-1?(Number.isInteger(indiceDestinoFinal)?indiceDestinoFinal:null):ordem[i+1];
const a=edge(prevR,x),b=edge(x,nextR),c=edge(prevR,nextR);
if(!a||!b||!c) return null;
let dt=-a.t-b.t+c.t,dd=-a.d-b.d+c.d;
const prevI=p===0?0:reduzida[p-1];
const nextI=p<reduzida.length?reduzida[p]:(Number.isInteger(indiceDestinoFinal)?indiceDestinoFinal:null);
const old=edge(prevI,nextI),n1=edge(prevI,x),n2=edge(x,nextI);
if(!old||!n1||!n2) return null;
dt += -old.t+n1.t+n2.t; dd += -old.d+n1.d+n2.d;
return {dt,dd};
}

function melhorDeltaV711(delta,melhor){
if(!delta) return false;
const melhora = delta.dt < -V711_TOL_TEMPO_SEG ||
(Math.abs(delta.dt)<=V711_TOL_TEMPO_SEG && delta.dd < -V711_TOL_DIST_METROS);
if(!melhora) return false;
if(!melhor) return true;
return delta.dt < melhor.dt-V711_TOL_TEMPO_SEG ||
(Math.abs(delta.dt-melhor.dt)<=V711_TOL_TEMPO_SEG && delta.dd<melhor.dd);
}

function melhorRealocacaoV711(ordem,resultado,indiceDestinoFinal){
let best=null;
for(let i=0;i<ordem.length;i++){
for(let p=0;p<=ordem.length-1;p++){
const delta=deltaRealocacaoV711(ordem,i,p,resultado,indiceDestinoFinal);
if(melhorDeltaV711(delta,best)) best={i,p,...delta};
}
}
return best;
}

function prefixosReversaoV711(ordem,resultado){
const pt=Array(ordem.length).fill(0),pd=Array(ordem.length).fill(0);
for(let k=0;k<ordem.length-1;k++){
const a=ordem[k],b=ordem[k+1];
const tf=valorMatriz(resultado.duracoes,a,b),tr=valorMatriz(resultado.duracoes,b,a);
const df=valorMatriz(resultado.distancias,a,b),dr=valorMatriz(resultado.distancias,b,a);
if(![tf,tr,df,dr].every(Number.isFinite)){pt[k+1]=Infinity;pd[k+1]=Infinity;continue;}
pt[k+1]=Number.isFinite(pt[k])?pt[k]+(tr-tf):Infinity;
pd[k+1]=Number.isFinite(pd[k])?pd[k]+(dr-df):Infinity;
}
return {pt,pd};
}

function melhor2OptV711(ordem,resultado,indiceDestinoFinal){
if(ordem.length<3) return null;
const {pt,pd}=prefixosReversaoV711(ordem,resultado);
let best=null;
for(let i=0;i<ordem.length-1;i++){
const prev=i===0?0:ordem[i-1];
for(let j=i+1;j<ordem.length;j++){
const next=j===ordem.length-1?(Number.isInteger(indiceDestinoFinal)?indiceDestinoFinal:null):ordem[j+1];
const a=ordem[i],b=ordem[j];
const t1=valorMatriz(resultado.duracoes,prev,a),t2=valorMatriz(resultado.duracoes,prev,b);
const d1=valorMatriz(resultado.distancias,prev,a),d2=valorMatriz(resultado.distancias,prev,b);
if(![t1,t2,d1,d2].every(Number.isFinite)) continue;
let dt=t2-t1,dd=d2-d1;
if(next!==null){
const tOld=valorMatriz(resultado.duracoes,b,next),tNew=valorMatriz(resultado.duracoes,a,next);
const dOld=valorMatriz(resultado.distancias,b,next),dNew=valorMatriz(resultado.distancias,a,next);
if(![tOld,tNew,dOld,dNew].every(Number.isFinite)) continue;
dt+=tNew-tOld;dd+=dNew-dOld;
}
const it=pt[j]-pt[i],id=pd[j]-pd[i];
if(!Number.isFinite(it)||!Number.isFinite(id)) continue;
dt+=it;dd+=id;
if(melhorDeltaV711({dt,dd},best)) best={i,j,dt,dd};
}
}
return best;
}

function refinarLexicograficoV711(ordemInicial,resultado,indiceDestinoFinal){
let ordem=[...ordemInicial];
for(let it=0;it<Math.min(90,ordem.length*2);it++){
const m=melhorRealocacaoV711(ordem,resultado,indiceDestinoFinal);if(!m) break;
ordem=aplicarRealocacao(ordem,m);
}
for(let it=0;it<Math.min(35,ordem.length);it++){
const m=melhor2OptV711(ordem,resultado,indiceDestinoFinal);if(!m) break;
ordem=aplicar2Opt(ordem,m);
}
for(let it=0;it<Math.min(45,ordem.length);it++){
const m=melhorRealocacaoV711(ordem,resultado,indiceDestinoFinal);if(!m) break;
ordem=aplicarRealocacao(ordem,m);
}
return ordem;
}

function otimizarComoMotoristaV711(validos,ordemShopee,resultado,indiceDestinoFinal,inicio,destino){
const idIdx=new Map(validos.map((g,i)=>[g.id,i+1]));
const todos=validos.map((_,i)=>i+1);
const shopee=ordemShopee.map(g=>idIdx.get(g.id)).filter(Number.isInteger);
const seeds=[],vistos=new Set();
function add(nome,ordem){
if(!ordem||ordem.length!==todos.length) return;
const sig=ordem.join('>');if(vistos.has(sig)) return;vistos.add(sig);seeds.push({nome,ordemIndices:[...ordem]});
}
add('shopee',shopee);
add('vizinho-tempo',rotaVizinhoTempoV711(todos,resultado));
add('insercao-tempo',rotaInsercaoTempoV711(todos,resultado,indiceDestinoFinal));
try{
const sc=gerarCandidatasScannerAprendidoV710(validos,resultado,indiceDestinoFinal,inicio,destino);
(sc.candidatas||[]).forEach((c,k)=>add('scanner-'+k,c.ordemIndices));
}catch(e){console.warn('Scanner V7.10 não entrou como candidata:',e);}

const avaliadas=[];
for(const seed of seeds){
let r=refinarLexicograficoV711(seed.ordemIndices,resultado,indiceDestinoFinal);
r=repararJanelasHardV75(r,resultado,validos);
const metricas=metricasOperacionaisMatrizV75(r,resultado,indiceDestinoFinal,validos);
const janelas=avaliarJanelasRotaV75(r,resultado,validos);
avaliadas.push({...seed,ordemIndices:r,metricas,janelas});
}
const baseShopee=avaliadas.find(a=>a.nome==='shopee') || {
ordemIndices:shopee,
metricas:metricasOperacionaisMatrizV75(shopee,resultado,indiceDestinoFinal,validos),
janelas:avaliarJanelasRotaV75(shopee,resultado,validos),nome:'shopee'
};
const factiveis=avaliadas.filter(a=>metricasRotaValidas(a.metricas)&&a.janelas.violacoesHard.length===0);
let pool=factiveis.length?factiveis:avaliadas.filter(a=>metricasRotaValidas(a.metricas));
if(!pool.length) return {melhor:baseShopee,baseline:baseShopee,avaliadas,manteveOriginal:true};

// Se a Shopee já cumpre janelas HARD, nenhuma alternativa mais lenta é aceita.
if(baseShopee.janelas.violacoesHard.length===0 && metricasRotaValidas(baseShopee.metricas)){
pool=pool.filter(a=>a.metricas.duracao<=baseShopee.metricas.duracao+V711_TOL_TEMPO_SEG);
if(!pool.length) pool=[baseShopee];
}
pool.sort((a,b)=>compararMetricasV711(a.metricas,b.metricas));
let melhor=pool[0]||baseShopee;

// Trava final: sem janela HARD obrigando o contrário, jamais piora o tempo
// da referência. Em empate de tempo, jamais aumenta km.
if(baseShopee.janelas.violacoesHard.length===0 && metricasRotaValidas(baseShopee.metricas)){
if(melhor.metricas.duracao>baseShopee.metricas.duracao+V711_TOL_TEMPO_SEG ||
   (Math.abs(melhor.metricas.duracao-baseShopee.metricas.duracao)<=V711_TOL_TEMPO_SEG && melhor.metricas.distancia>baseShopee.metricas.distancia+V711_TOL_DIST_METROS)){
melhor=baseShopee;
}
}
const manteveShopee=melhor.ordemIndices.join('>')===baseShopee.ordemIndices.join('>');
return {melhor,baseline:baseShopee,avaliadas,manteveShopee};
}

async function executarOtimizacaoRota(modo, destinoFinal){
abrirOverlayOtimizacao('Buscando sua localização atual...');

try{
const inicio = await obterPontoInicialOtimizacao();
const validos = gruposComCoordenadaValida();
const invalidos = grupos.filter(g=>!validos.includes(g));

if(validos.length === 0) throw new Error('SEM_COORDENADAS');

let destino = null;
if(modo === 'endereco'){
if(!pontoValido(destinoFinal)) throw new Error('DESTINO_NAO_SELECIONADO');
destino = {
lat:Number(destinoFinal.lat),
lng:Number(destinoFinal.lng),
nome:destinoFinal.nome || '',
endereco:destinoFinal.endereco || '',
texto:destinoFinal.texto || destinoFinal.nome || destinoFinal.endereco || 'Ponto escolhido no mapa'
};
}

const ordemShopee = [...validos].sort((a,b)=>(a.indiceImportacao ?? 0) - (b.indiceImportacao ?? 0));

atualizarProgressoOtimizacao('Montando a matriz completa de todas as paradas...');

const pontosGlobais = [inicio, ...validos.map(pontoGrupo)];
const indiceDestinoFinal = destino ? pontosGlobais.length : null;
if(destino) pontosGlobais.push(destino);

let matrizGlobal = null;
let ordem = null;
let metricasMelhor = null;
let metricasShopee = null;
let avaliacoes = [];

try{
matrizGlobal = await consultarMatrizGlobalOSRM(pontosGlobais);

atualizarProgressoOtimizacao('Comparando a rota original com alternativas e melhorando apenas o que realmente reduz tempo...');
const decisaoV711 = otimizarComoMotoristaV711(validos, ordemShopee, matrizGlobal, indiceDestinoFinal, inicio, destino);
avaliacoes = decisaoV711.avaliadas || [];
if(!decisaoV711.melhor) throw new Error('SEM_ROTA_GLOBAL');

ordem = decisaoV711.melhor.ordemIndices.map(i=>validos[i-1]);
metricasMelhor = decisaoV711.melhor.metricas;
metricasShopee = decisaoV711.baseline.metricas;

if(decisaoV711.melhor.janelas && decisaoV711.melhor.janelas.violacoesHard.length){
mostrarToast('⚠️ Nenhuma sequência conseguiu cumprir todos os horários limite', 'alerta');
}

// A checagem de "passou perto" continua disponível, mas agora uma mudança
// só permanece se não piorar a métrica lexicográfica tempo -> km.
if(!decisaoV711.manteveShopee){
atualizarProgressoOtimizacao('Conferindo entregas que ficaram no caminho sem permitir piora...');
try{
const antes=[...ordem];
const antesMetricas={...metricasMelhor};
const reparada=await repararPassagensReaisV710(ordem,inicio,destino,matrizGlobal,validos,indiceDestinoFinal);
if(reparada&&reparada.length===ordem.length){
const idIdx=new Map(validos.map((g,i)=>[g.id,i+1]));
const idx=reparada.map(g=>idIdx.get(g.id)).filter(Number.isInteger);
const m=metricasOperacionaisMatrizV75(idx,matrizGlobal,indiceDestinoFinal,validos);
if(compararMetricasV711(m,antesMetricas)<=0){ordem=reparada;metricasMelhor=m;}
else ordem=antes;
}
}catch(e){console.warn('Checagem de passagens ignorada:',e);}
}

}catch(erroGlobal){
console.warn('Matriz global indisponível; usando fallback viário completo:', erroGlobal);

// Sem matriz viária confiável não tentamos "inventar" uma otimização.
// Mantemos a ordem original, porque ela é a baseline segura da V7.11.
atualizarProgressoOtimizacao('Roteador indisponível; mantendo a ordem original com segurança...');
ordem=[...ordemShopee];
metricasShopee=await calcularMetricasRota(ordemShopee,inicio,destino);
if(metricasRotaValidas(metricasShopee)){
metricasShopee.duracao += ordemShopee.reduce((acc,g)=>acc+tempoServicoGrupoSegundos(g),0);
}
metricasMelhor=metricasShopee?{...metricasShopee}:null;
matrizGlobal={provedor:'FALLBACK_SHOPEE_V711'};
mostrarToast('⚠️ Sem matriz viária confiável; mantive a ordem original', 'alerta');
}

atualizarProgressoOtimizacao('Validando a nova rota...');
if(!metricasRotaValidas(metricasMelhor)){
metricasMelhor = await calcularMetricasRota(ordem, inicio, destino);
}
if(!metricasRotaValidas(metricasShopee)){
metricasShopee = await calcularMetricasRota(ordemShopee, inicio, destino);
}

// Preserva pontos sem coordenada no final e mantém a referência original.
invalidos.sort((a,b)=>(a.indiceImportacao ?? 0) - (b.indiceImportacao ?? 0));
grupos = [...ordem, ...invalidos];
grupos.forEach((g,indice)=>{ g.ordemOtimizada = indice + 1; });

atualizarProgressoOtimizacao('Calculando a comparação com a rota original...');

metaRota = {
modo,
provedor:(matrizGlobal && matrizGlobal.provedor) ? matrizGlobal.provedor : 'OSRM',
criterio:'v7_11_baseline_shopee_tempo_primeiro_km_depois',
resultadoOtimizacao:(ordem.length===ordemShopee.length && ordem.every((g,i)=>g.id===ordemShopee[i].id)) ? 'shopee_mantida' : 'melhorada',
distanciaMetros:Number.isFinite(metricasMelhor.distancia) ? metricasMelhor.distancia : null,
duracaoSegundos:Number.isFinite(metricasMelhor.duracao) ? metricasMelhor.duracao : null,
distanciaShopeeMetros:Number.isFinite(metricasShopee && metricasShopee.distancia) ? metricasShopee.distancia : null,
duracaoShopeeSegundos:Number.isFinite(metricasShopee && metricasShopee.duracao) ? metricasShopee.duracao : null,
destinoFinal:destino ? {...destino} : null,
inicio:{lat:inicio.lat,lng:inicio.lng,precisao:inicio.precisao ?? null},
atualizadoEm:Date.now()
};

mapaFoiEnquadrado = false;
salvarStorage();
renderizarTudo();
fecharOverlayOtimizacao();
mostrarToast(metaRota.resultadoOtimizacao==='shopee_mantida' ? '✅ A ordem original já era a melhor referência encontrada; ordem mantida' : '⚡ Rota melhorada: menor tempo primeiro, km depois', 'sucesso');

}catch(erro){
console.error('Falha na otimização da rota:', erro);
fecharOverlayOtimizacao();

if(erro && erro.message === 'LOCALIZACAO_INDISPONIVEL'){
mostrarToast('⚠️ Não consegui sua localização. No PC, use o ajuste manual no mapa e tente novamente.', 'alerta');
abrirModalOtimizacao(false);
return;
}
if(erro && erro.message === 'DESTINO_NAO_SELECIONADO'){
mostrarToast('⚠️ Escolha o ponto final no mapa', 'alerta');
abrirModalOtimizacao(false);
abrirSeletorDestinoFinal();
return;
}

mostrarToast('⚠️ Não foi possível otimizar agora. Tente novamente.', 'alerta');
abrirModalOtimizacao(false);
}
}

function formatarDuracaoRota(segundos){
if(!Number.isFinite(segundos)) return null;
const totalMin = Math.max(1, Math.round(segundos/60));
const h = Math.floor(totalMin/60);
const m = totalMin%60;
return h > 0 ? `${h}h ${String(m).padStart(2,'0')}min` : `${m} min`;
}

function formatarDistanciaRota(metros){
if(!Number.isFinite(metros)) return null;
return metros >= 1000 ? `${(metros/1000).toFixed(metros >= 10000 ? 0 : 1)} km` : `${Math.round(metros)} m`;
}

function htmlComparacaoTempoRota(){
if(!metaRota) return '';
const tempoAtual=formatarDuracaoRota(metaRota.duracaoSegundos);
const distAtual=formatarDistanciaRota(metaRota.distanciaMetros);
const temTempo=Number.isFinite(metaRota.duracaoShopeeSegundos)&&Number.isFinite(metaRota.duracaoSegundos);
const temDist=Number.isFinite(metaRota.distanciaShopeeMetros)&&Number.isFinite(metaRota.distanciaMetros);
let ganho='';
if(temTempo){const d=metaRota.duracaoShopeeSegundos-metaRota.duracaoSegundos;if(d>30)ganho=`${formatarDuracaoRota(d)} mais rápida`;else if(d<-30)ganho=`${formatarDuracaoRota(Math.abs(d))} a mais`;}
if(temDist){const d=metaRota.distanciaShopeeMetros-metaRota.distanciaMetros;if(Math.abs(d)>100){const txt=d>0?`${formatarDistanciaRota(d)} a menos`:`${formatarDistanciaRota(Math.abs(d))} a mais`;ganho=ganho?`${ganho} · ${txt}`:txt;}}
return `<div class="rota-resumo-v10">${iconeLinha('clock')}<div><strong>${tempoAtual||'Rota calculada'}${distAtual?` · ${distAtual}`:''}</strong>${ganho?`<small>${ganho}</small>`:''}</div></div>`;
}

function atualizarStatusOtimizacaoRota(){
const el=document.getElementById('statusOtimizacaoRota');
const btnRestaurar=document.getElementById('btnRestaurarShopee');
const btnOrganizar=document.getElementById('btnOrganizarPacotes');
if(!el)return;
if(!grupos.length){el.style.display='none';if(btnRestaurar)btnRestaurar.style.display='none';if(btnOrganizar)btnOrganizar.style.display='none';return;}
if(btnRestaurar)btnRestaurar.style.display='none';
const rotaReorganizada=metaRota&&['desenho','auto_v9'].includes(metaRota.modo);
if(btnOrganizar)btnOrganizar.style.display=(rotaReorganizada&&!metaRota.organizacaoPacotesConcluida)?'flex':'none';
if(metaRota&&metaRota.modo==='auto_v9'){
 const manteve=metaRota.resultadoOtimizacao==='shopee_mantida';
 const destino=pontoValido(metaRota.destinoFinal);
 el.style.display='block';
 el.innerHTML=`<div class="linha-status-rota">${iconeLinha(destino?'flag':'route')}<span>${manteve?'Rota analisada':'Rota otimizada'}${destino?' · final configurado':''}</span></div>${htmlComparacaoTempoRota()}`;
 return;
}
if(metaRota&&metaRota.modo==='desenho'){el.style.display='block';el.innerHTML=`<div class="linha-status-rota">${iconeLinha('pencil')}<span>Rota manual aplicada</span></div>${htmlComparacaoTempoRota()}`;return;}
el.style.display='none';
}

function htmlReferenciaRota(grupo){
if(!temOrdemOtimizada(grupo)) return '';
return `<div class="rota-referencia"><span class="rota-otimizada-pill">${iconeLinha('route')} <strong>${grupo.ordemOtimizada}</strong></span></div>`;
}

// ----------------------------------------------------------------------
// LÓGICA DE "É O MESMO LOCAL?" (usada no agrupamento da importação)
// ----------------------------------------------------------------------

// Remove acentos, baixa a caixa e limpa espaços - facilita comparar texto
function normalizarTexto(texto){
return String(texto || "")
.normalize("NFD")
.replace(/[\u0300-\u036f]/g, "")
.toLowerCase()
.replace(/\s+/g, " ")
.trim();
}

// Procura menções de apartamento/unidade/bloco/casa no endereço e monta
// uma "assinatura" com os números encontrados. Ex: "Bloco B apto 607"
// e "907 Bloco B" tem assinaturas diferentes -> são unidades diferentes.
function assinaturaUnidade(enderecoNormalizado){
const regex = /\b(?:apto|ap|apartamento|unidade|un|casa|bloco|bl|sala|loja|lote|quadra|qd)\.?\s*([a-z0-9\-]+)/gi;
const encontrados = [];
let m;
while((m = regex.exec(enderecoNormalizado)) !== null){
encontrados.push(m[1]);
}
if(encontrados.length === 0) return null;
return encontrados.sort().join("|");
}

// Posições (início/fim) dos números que pertencem a uma menção de
// apto/bloco/unidade - usado pra não confundir esses números com o
// número da casa/prédio.
function posicoesDeNumeroDeUnidade(enderecoNormalizado){
const regex = /\b(?:apto|ap|apartamento|unidade|un|casa|bloco|bl|sala|loja|lote|quadra|qd)\.?\s*([a-z0-9\-]+)/gi;
const posicoes = [];
let m;
while((m = regex.exec(enderecoNormalizado)) !== null){
const inicioValor = m.index + m[0].length - m[1].length;
posicoes.push({ inicio: inicioValor, fim: inicioValor + m[1].length });
}
return posicoes;
}

// Acha o nome da rua e o número da casa/prédio juntos: o número da casa
// é o primeiro número "livre" do endereço (que não faz parte de um
// "apto X"/"bloco Y"), esteja ele separado por vírgula ou não
// (cobre tanto "Rua Tal, 349" quanto "Rua Tal 349"). A rua é tudo que
// vem antes desse número.
function extrairRuaENumero(enderecoNormalizado){

// A mesma normalização usada na geocodificação é aplicada à comparação
// entre endereços, para "AV.", "AV" e "Avenida" serem equivalentes.
enderecoNormalizado = normalizarTexto(expandirAbreviacaoLogradouro(enderecoNormalizado));

const numeroRegex = /\d+/g;
const posicoesUnidade = posicoesDeNumeroDeUnidade(enderecoNormalizado);
let m;

while((m = numeroRegex.exec(enderecoNormalizado)) !== null){

const dentroDeUnidade = posicoesUnidade.some(
p => m.index >= p.inicio && m.index < p.fim
);

if(!dentroDeUnidade){

let rua = enderecoNormalizado
.slice(0, m.index)
.replace(/,\s*$/, "")
.trim();

rua = normalizarTexto(expandirAbreviacaoLogradouro(rua)).trim();

return { rua: rua || null, numero: m[0] };

}

}

return { rua: null, numero: null };

}

// Distância real em metros entre duas coordenadas (fórmula de Haversine)
function distanciaMetros(lat1, lng1, lat2, lng2){
const R = 6371000;
const rad = Math.PI / 180;
const dLat = (lat2 - lat1) * rad;
const dLng = (lng2 - lng1) * rad;
const a = Math.sin(dLat/2) ** 2 +
Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng/2) ** 2;
const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
return R * c;
}

// Raio (em metros) dentro do qual duas coordenadas ainda contam como
// "o mesmo prédio/local", cobrindo a variação natural do GPS.
const RAIO_MESMO_LOCAL_METROS = 25;

function paradasMesmoLocal(a, b){

const enderecoA = normalizarTexto(a.endereco);
const enderecoB = normalizarTexto(b.endereco);

const infoA = extrairRuaENumero(enderecoA);
const infoB = extrairRuaENumero(enderecoB);
const ruaA = infoA.rua;
const ruaB = infoB.rua;
const numeroA = infoA.numero;
const numeroB = infoB.numero;

// 1ª camada (a mais forte): número da casa/prédio diferente = SEMPRE
// locais diferentes, mesmo que a coordenada esteja bem perto - é
// exatamente o caso de duas casas vizinhas com GPS parecido.
if(numeroA && numeroB && numeroA !== numeroB){
return false;
}

// Reforça com o nome da rua: se além do número, a rua também bate,
// e os dois tiverem essa informação, é o mesmo prédio - MESMO que os
// apartamentos sejam diferentes. Isso é seguro agora porque cada pacote
// já controla seu próprio status individual (ver "Ocorrência só neste
// pacote"), então não precisamos mais separar por apto pra isso.
const ruaENumeroBatem = !!(ruaA && ruaB && numeroA && numeroB && ruaA === ruaB && numeroA === numeroB);

if(ruaENumeroBatem){
return true;
}

// 2ª camada: sem rua+número suficiente pra confirmar o prédio, usa
// unidade/apto/bloco como pista de que é o mesmo local.
const unidadeA = assinaturaUnidade(enderecoA);
const unidadeB = assinaturaUnidade(enderecoB);

if(unidadeA && unidadeB){
return unidadeA === unidadeB;
}

// 3ª camada: sem informação de endereço suficiente, decide pela
// distância real entre as coordenadas.
const latA = parseFloat(a.lat);
const lngA = parseFloat(a.lng);
const latB = parseFloat(b.lat);
const lngB = parseFloat(b.lng);

if(!isNaN(latA) && !isNaN(lngA) && !isNaN(latB) && !isNaN(lngB)){
return distanciaMetros(latA, lngA, latB, lngB) <= RAIO_MESMO_LOCAL_METROS;
}

// Último recurso (sem coordenada nenhuma): compara o texto normalizado
return enderecoA === enderecoB;

}

// ----------------------------------------------------------------------
// ORDENAÇÃO E RENDERIZAÇÃO DA LISTA
// ----------------------------------------------------------------------

function ordemStatus(status){
if(status === 'pendente') return 0;
if(status === 'ocorrencia') return 1;
return 2; // entregue vai para o final
}

function listaOrdenada(){
return grupos
.map((g,indiceOriginal)=>({g,indiceOriginal}))
.sort((a,b)=>{
const diff = Number(!a.g.pacotes.some(p=>p.status==='pendente')) - Number(!b.g.pacotes.some(p=>p.status==='pendente')); 
if(diff !== 0) return diff;
return a.indiceOriginal - b.indiceOriginal;
})
.map(x=>x.g);
}

// Lista da aba principal: some daqui só quando TODOS os pacotes da parada
// estão em ocorrência (falha total - nada mais a fazer ali). Casos mistos
// (ex: 4 entregues + 1 ocorrência) continuam aqui, porque ainda há
// trabalho pendente/ativo nessa parada.
function listaPrincipal(){
return listaOrdenada().filter(g => !g.pacotes.every(p => p.status === 'ocorrencia'));
}

// Um Stop é considerado "de verdade" quando existe e não é só um
// traço/vazio. Cobre casos de planilha sem coluna Stop, Stop vazio
// ou com valor "-" (o que antes aparecia errado como "Parada -").
function ehStopValido(stop){
return !!stop && String(stop).trim() !== '' && String(stop).trim() !== '-';
}

function temOrdemOtimizada(grupo){
return grupo && grupo.ordemOtimizada !== null && grupo.ordemOtimizada !== undefined && grupo.ordemOtimizada !== '' && Number.isFinite(Number(grupo.ordemOtimizada));
}

function tituloParada(grupo){
if(temOrdemOtimizada(grupo)){
return iconeLinha('pin') + " Parada " + grupo.ordemOtimizada;
}
return ehStopValido(grupo.stop) ? (iconeLinha('pin') + " Parada " + grupo.stop) : (iconeLinha('pin') + " Extra");
}

// Extrai só o primeiro nome do destinatário (evita expor o sobrenome completo)
function primeiroNome(nomeCompleto){
if(!nomeCompleto) return "";
return String(nomeCompleto).trim().split(/\s+/)[0];
}

// Monta o conteúdo interno de UMA localização (endereço, status, pacotes,
// Waze e botões de ação) - usado tanto para paradas sozinhas quanto para
// cada "sub-local" dentro de uma Parada composta (ex: casa 43/45/1).
function construirConteudoLocal(grupo){

let htmlPacotes = "";

grupo.pacotes.forEach((pacote, indice)=>{

let acaoPacoteHtml = "";

if(pacote.status === 'ocorrencia'){
acaoPacoteHtml = `
<div class="ocorrencia-pacote-texto">${iconeLinha('alert')} Ocorrência${pacote.motivo ? ': ' + pacote.motivo : ''}</div>
<div class="btn-linha-pacote">
<button class="entregue-pacote-btn" onclick="marcarEntreguePacote('${grupo.id}', ${indice})">${iconeLinha('check')} Entregar</button>
<button class="desfazer-pacote-btn" onclick="desfazerStatusPacote('${grupo.id}', ${indice})">${iconeLinha('undo')} Desfazer</button>
</div>
`;
}else{
acaoPacoteHtml = `
<button class="ocorrencia-pacote-btn" onclick="abrirModalMotivoPacote('${grupo.id}', ${indice})">${iconeLinha('alert')} Ocorrência só neste pacote</button>
`;
}

htmlPacotes += `

<div class="pacote pacote-status-${pacote.status}">

<div class="codigo">
${pacote.codigo}
</div>

${pacote.destinatario ? `<div class="nome-cliente-pacote">${iconeLinha('user')} ${primeiroNome(pacote.destinatario)}</div>` : ''}

<div class="detalhe">
${pacote.endereco}
</div>

${pacote.status === 'entregue' ? `<div class="entregue-pacote-texto">${iconeLinha('check')} Entregue</div>` : acaoPacoteHtml}

</div>

`;

});

const badgeStatusHtml = badgeStatusGrupoHtml(grupo);

return `

<div class="endereco">
${grupo.endereco}
</div>
${htmlReferenciaRota(grupo)}

<div class="badge">
${grupo.pacotes.length}
pacote(s) neste local
</div>
${badgeStatusHtml}

<button
class="toggle"
onclick="alternarPacotes('${grupo.id}')">
Mostrar/Ocultar pacotes
</button>

<div
id="pacotes_${grupo.id}"
class="pacotes"
style="${painelPacotesAbertos.has(grupo.id) ? 'display:block;' : ''}">

${htmlPacotes}

</div>

<button class="waze" onclick="abrirWaze('${grupo.lat}','${grupo.lng}')">${iconeLinha('waze')} Abrir no Waze</button>

<div class="btn-linha">
<button class="entregue-btn" onclick="marcarEntregue('${grupo.id}')">${iconeLinha('check')} Entregue</button>
<button class="ocorrencia-btn" onclick="abrirModalMotivo('${grupo.id}')">${iconeLinha('alert')} Ocorrência</button>
<button class="desfazer-btn" onclick="desfazerStatus('${grupo.id}')">${iconeLinha('undo')} Desfazer</button>
</div>

`;

}

function renderizarTudo(){

const lista =
document.getElementById("lista");

lista.innerHTML = "";

const ordenados = listaPrincipal();

document.getElementById("locais")
.innerText = grupos.length;

let divisoriaEntreguesInserida = false;

// Agrupa visualmente execuções consecutivas com o mesmo número de Parada
// (só na aba Lista - o mapa e a aba Ocorrências continuam tratando cada
// endereço como um item independente, sem nenhuma mudança lá).
let i = 0;

while(i < ordenados.length){

const grupo = ordenados[i];
const statusGrupo = statusEfetivoGrupo(grupo);

if(statusGrupo === 'entregue' && !divisoriaEntreguesInserida){
lista.innerHTML += `<div class="divisoria-entregues"><span>${iconeLinha('check')} Entregues</span></div>`;
divisoriaEntreguesInserida = true;
}

const bloco = [grupo];
let j = i + 1;

while(
j < ordenados.length &&
!temOrdemOtimizada(grupo) &&
ehStopValido(grupo.stop) &&
ordenados[j].stop === grupo.stop &&
statusEfetivoGrupo(ordenados[j]) === statusGrupo
){
bloco.push(ordenados[j]);
j++;
}

if(bloco.length === 1){

lista.innerHTML += `
<div class="grupo status-${statusGrupo}" id="grupo_${grupo.id}">
<h3>${tituloParada(grupo)}</h3>
${construirConteudoLocal(grupo)}
</div>
`;

}else{

let subLocaisHtml = "";
let totalPacotesBloco = 0;

bloco.forEach(item=>{
totalPacotesBloco += item.pacotes.length;
subLocaisHtml += `
<div class="sub-local status-${statusEfetivoGrupo(item)}" id="grupo_${item.id}">
${construirConteudoLocal(item)}
</div>
`;
});

lista.innerHTML += `
<div class="parada-composta">
<h3>${tituloParada(grupo)}</h3>
<div class="badge-total-parada">${iconeLinha('package')} ${totalPacotesBloco} pacote(s) ao todo nesta parada</div>
${subLocaisHtml}
</div>
`;

}

i = j;

}

atualizarEstatisticas();
atualizarMapa();
renderizarOcorrencias();
renderizarOcorrenciasHome();
atualizarStatusOtimizacaoRota();
atualizarVisibilidadeOrganizacaoPacotes();

}

function renderizarOcorrencias(){

const container = document.getElementById('listaOcorrencias');
const ocorrencias = grupos.filter(g => g.pacotes.some(p => p.status === 'ocorrencia'));

if(ocorrencias.length === 0){
container.innerHTML = `<div class="aviso-vazio">Nenhuma ocorrência no momento</div>`;
return;
}

container.innerHTML = "";

ocorrencias.forEach(grupo=>{

let htmlPacotes = "";

grupo.pacotes.forEach((pacote, indice)=>{

let acaoPacoteHtml = "";

if(pacote.status === 'ocorrencia'){
acaoPacoteHtml = `
<div class="ocorrencia-pacote-texto">${iconeLinha('alert')} Ocorrência${pacote.motivo ? ': ' + pacote.motivo : ''}</div>
<div class="btn-linha-pacote">
<button class="entregue-pacote-btn" onclick="marcarEntreguePacote('${grupo.id}', ${indice})">${iconeLinha('check')} Entregar</button>
<button class="desfazer-pacote-btn" onclick="desfazerStatusPacote('${grupo.id}', ${indice})">${iconeLinha('undo')} Desfazer</button>
</div>
`;
}else{
acaoPacoteHtml = `
<button class="ocorrencia-pacote-btn" onclick="abrirModalMotivoPacote('${grupo.id}', ${indice})">${iconeLinha('alert')} Ocorrência só neste pacote</button>
`;
}

htmlPacotes += `
<div class="pacote pacote-status-${pacote.status}">
<div class="codigo">${pacote.codigo}</div>
${pacote.destinatario ? `<div class="nome-cliente-pacote">${iconeLinha('user')} ${primeiroNome(pacote.destinatario)}</div>` : ''}
<div class="detalhe">${pacote.endereco}</div>
${pacote.status === 'entregue' ? `<div class="entregue-pacote-texto">${iconeLinha('check')} Entregue</div>` : acaoPacoteHtml}
</div>
`;

});

container.innerHTML += `
<div class="grupo status-${statusEfetivoGrupo(grupo)}" id="grupo_oc_${grupo.id}">
<h3>${tituloParada(grupo)}</h3>
<div class="endereco">${grupo.endereco}</div>
${htmlReferenciaRota(grupo)}
<div class="badge">${grupo.pacotes.length} pacote(s) neste local</div>
${badgeStatusGrupoHtml(grupo)}

<button class="toggle" onclick="alternarPacotes('oc_${grupo.id}')">Mostrar/Ocultar pacotes</button>
<div id="pacotes_oc_${grupo.id}" class="pacotes" style="${painelPacotesAbertos.has('oc_' + grupo.id) ? 'display:block;' : ''}">${htmlPacotes}</div>

<button class="waze" onclick="abrirWaze('${grupo.lat}','${grupo.lng}')">${iconeLinha('waze')} Abrir no Waze</button>

<div class="btn-linha">
<button class="entregue-btn" onclick="marcarEntregue('${grupo.id}')">${iconeLinha('check')} Entregue</button>
<button class="desfazer-btn" onclick="desfazerStatus('${grupo.id}')">${iconeLinha('undo')} Desfazer</button>
</div>
</div>
`;

});

}

function renderizarOcorrenciasHome(){
const container=document.getElementById('homeUrgencias');
const contador=document.getElementById('homeUrgenciasContador');
if(!container)return;
const itens=[];
grupos.forEach(g=>g.pacotes.forEach((p,indice)=>{if(p.status==='ocorrencia')itens.push({g,p,indice});}));
if(contador)contador.textContent=String(itens.length);
if(!itens.length){container.innerHTML='<div class="home-sem-urgencias">Nenhuma urgência no momento.</div>';return;}
container.innerHTML=itens.map(({g,p,indice})=>`<article class="home-urgencia-card">
<div class="home-urgencia-top"><span class="home-urgencia-label">${iconeLinha('alert')} Urgência</span><span class="home-urgencia-parada">${temOrdemOtimizada(g)?'Parada '+g.ordemOtimizada:(ehStopValido(g.stop)?'Parada '+g.stop:'Extra')}</span></div>
<strong>${escaparHtmlTexto(p.motivo||'Ocorrência registrada')}</strong>
<p>${escaparHtmlTexto(p.endereco||g.endereco||'')}</p>
<div class="home-urgencia-actions"><button class="home-urgencia-open" onclick="irParaOcorrenciaHome('${g.id}')">${iconeLinha('alert')} Abrir ocorrência</button><button class="home-urgencia-map" onclick="focarGrupoNoMapaV10('${g.id}')">${iconeLinha('map')} Ver no mapa</button></div>
</article>`).join('');
}
function irParaOcorrenciaHome(id){focarGrupoNoMapaV10(id);}
function focarGrupoNoMapaV10(id){const g=encontrarGrupo(id);if(!g)return;irParaAba(1);setTimeout(()=>{inicializarMapaSeNecessario();const lat=Number(g.lat),lng=Number(g.lng);if(mapa&&Number.isFinite(lat)&&Number.isFinite(lng)){mapa.setView([lat,lng],17);abrirInfoMapa(id);}},220);}

function alternarPacotes(id){

const elemento =
document.getElementById(
"pacotes_" + id
);

if(
elemento.style.display ===
"block"
){

elemento.style.display =
"none";

painelPacotesAbertos.delete(id);

}else{

elemento.style.display =
"block";

painelPacotesAbertos.add(id);

}

}

function abrirWaze(lat,lng){

if(!lat || !lng){

alert(
"Latitude ou Longitude não encontrada."
);

return;

}

window.open(
`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
'_blank'
);

}

// ----------------------------------------------------------------------
// V4.1 - STATUS (agora por PACOTE, não mais por parada inteira)
// Os botões grandes continuam agindo em massa (toda a parada de uma vez);
// cada pacote também pode ter seu próprio status individual, para os
// casos em que só 1 de vários pacotes no mesmo local dá problema.
// ----------------------------------------------------------------------

function encontrarGrupo(id){
return grupos.find(g => g.id === id);
}

// Calcula o status "efetivo" da parada a partir dos pacotes dela:
// só é 'entregue' se TODOS os pacotes estiverem entregues; é 'ocorrencia'
// se PELO MENOS UM pacote estiver com ocorrência (mesmo com outros já
// entregues); caso contrário, é 'pendente'.
function statusEfetivoGrupo(grupo){
if(grupo.pacotes.every(p => p.status === 'entregue')) return 'entregue';
if(grupo.pacotes.some(p => p.status === 'ocorrencia')) return 'ocorrencia';
return 'pendente';
}

// Monta o selo de status da parada, já considerando casos mistos
// (ex: 4 entregues e 1 com ocorrência no mesmo local)
function badgeStatusGrupoHtml(grupo){

const total = grupo.pacotes.length;
const entregues = grupo.pacotes.filter(p => p.status === 'entregue').length;
const ocorrencias = grupo.pacotes.filter(p => p.status === 'ocorrencia').length;
const pendentes = total - entregues - ocorrencias;

const misto = (ocorrencias > 0 && (entregues > 0 || pendentes > 0));

if(misto){
let partes = [];
if(pendentes > 0) partes.push(`${pendentes} pendente(s)`);
if(entregues > 0) partes.push(`${entregues} entregue(s)`);
if(ocorrencias > 0) partes.push(`${ocorrencias} ocorrência(s)`);
return `<span class="badge-status misto">${partes.join(' · ')}</span>`;
}

if(entregues === total) return `<span class="badge-status entregue">${iconeLinha('check')} Entregue</span>`;
if(ocorrencias === total) return `<span class="badge-status ocorrencia">${iconeLinha('alert')} Ocorrência</span>`;
return `<span class="badge-status pendente">${iconeLinha('package')} Pendente</span>`;

}

// Ação em massa (botão grande "Entregue"): marca como entregue todo
// pacote que ainda não estiver com ocorrência registrada individualmente
// - assim não sobrescreve uma exceção que você já marcou pacote a pacote.
function marcarEntregue(id){

const grupo = encontrarGrupo(id);
if(!grupo) return;

let algumPacoteMudou = false;

grupo.pacotes.forEach(p => {
if(p.status !== 'ocorrencia' && p.status !== 'entregue'){
p.status = 'entregue';
algumPacoteMudou = true;
}
});

salvarStorage();
renderizarTudo();

if(algumPacoteMudou){
mostrarToast(fraseAleatoria(FRASES_ENTREGA), 'sucesso');
tocarSomEntrega();
}else{
mostrarToast('⚠️ Só tem pacote em ocorrência aqui - abra "Mostrar/Ocultar pacotes" e resolva ele direto', 'alerta');
}

}

// Versão "sem exceção" usada só no painel do mapa: como lá não existe
// controle por pacote individual, o botão Entregue precisa resolver
// TUDO da parada de uma vez, inclusive pacotes já em ocorrência -
// senão o clique não tem efeito nenhum quando só havia ocorrência ali.
function marcarEntregueSemExcecao(id){
const grupo = encontrarGrupo(id);
if(!grupo) return;
grupo.pacotes.forEach(p => {
p.status = 'entregue';
p.motivo = null;
});
salvarStorage();
renderizarTudo();
mostrarToast(fraseAleatoria(FRASES_ENTREGA), 'sucesso');
tocarSomEntrega();
}

// Alvo do modal de motivo: pode ser a parada inteira ({tipo:'grupo'}) ou
// um pacote específico dentro dela ({tipo:'pacote', indice}).
let alvoAguardandoMotivo = null;

function abrirModalMotivo(id){
alvoAguardandoMotivo = { tipo:'grupo', grupoId:id };
document.getElementById('modalMotivo').classList.add('aberto');
}

// Exceção individual: marca ocorrência só num pacote específico da lista,
// sem afetar os demais pacotes daquela mesma parada.
function abrirModalMotivoPacote(grupoId, indice){
alvoAguardandoMotivo = { tipo:'pacote', grupoId:grupoId, indice:indice };
document.getElementById('modalMotivo').classList.add('aberto');
}

function fecharModalMotivo(){
alvoAguardandoMotivo = null;
document.getElementById('modalMotivo').classList.remove('aberto');
}

function confirmarOcorrencia(motivo){

if(!alvoAguardandoMotivo){ fecharModalMotivo(); return; }

const grupo = encontrarGrupo(alvoAguardandoMotivo.grupoId);

if(grupo){

if(alvoAguardandoMotivo.tipo === 'grupo'){
// Ação em massa: toda a parada (todos os pacotes) vira ocorrência
grupo.pacotes.forEach(p => {
p.status = 'ocorrencia';
p.motivo = motivo;
});
mostrarToast(fraseAleatoria(FRASES_OCORRENCIA), 'alerta');
}else{
// Exceção: só o pacote específico vira ocorrência
const pacote = grupo.pacotes[alvoAguardandoMotivo.indice];
if(pacote){
pacote.status = 'ocorrencia';
pacote.motivo = motivo;
mostrarToast(fraseAleatoria(FRASES_OCORRENCIA), 'alerta');
}
}

salvarStorage();
renderizarTudo();

}

fecharModalMotivo();

}

// Ação em massa (botão grande "Desfazer"): volta todos os pacotes da
// parada para pendente, inclusive os que tinham ocorrência individual.
function desfazerStatus(id){
const grupo = encontrarGrupo(id);
if(!grupo) return;
grupo.pacotes.forEach(p => {
p.status = 'pendente';
p.motivo = null;
});
salvarStorage();
renderizarTudo();
mostrarToast('↩️ Status desfeito', 'neutro');
}

// Desfazer individual: volta só 1 pacote específico para pendente
function desfazerStatusPacote(grupoId, indice){
const grupo = encontrarGrupo(grupoId);
if(!grupo) return;
const pacote = grupo.pacotes[indice];
if(!pacote) return;
pacote.status = 'pendente';
pacote.motivo = null;
salvarStorage();
renderizarTudo();
mostrarToast('↩️ Pacote voltou a pendente', 'neutro');
}

// Resolve uma ocorrência marcando o pacote como entregue direto, sem
// precisar desfazer primeiro (ex: você resolveu o problema na hora e
// conseguiu entregar mesmo assim).
function marcarEntreguePacote(grupoId, indice){
const grupo = encontrarGrupo(grupoId);
if(!grupo) return;
const pacote = grupo.pacotes[indice];
if(!pacote) return;
pacote.status = 'entregue';
pacote.motivo = null;
salvarStorage();
renderizarTudo();
mostrarToast(fraseAleatoria(FRASES_ENTREGA), 'sucesso');
tocarSomEntrega();
}

// ----------------------------------------------------------------------
// TOAST DE CONFIRMAÇÃO (animação rápida ao marcar status)
// ----------------------------------------------------------------------

let idTimeoutToast = null;

// Um pouco de personalidade nas mensagens - em vez de repetir sempre a
// mesma frase, sorteia entre algumas variações.
const FRASES_ENTREGA = [
'✅ Entrega confirmada!',
'🚚 Mandou bem, mais uma na conta!',
'📦 Show, entregue!',
'✅ Boa! Seguindo o baile.'
];

const FRASES_OCORRENCIA = [
'⚠️ Ocorrência registrada',
'⚠️ Anotado, bora pra próxima',
'⚠️ Beleza, já ficou registrado'
];

function fraseAleatoria(lista){
return lista[Math.floor(Math.random() * lista.length)];
}

function mostrarToast(mensagem, tipo){

let toast = document.getElementById('toastCopiloto');

if(!toast){
toast = document.createElement('div');
toast.id = 'toastCopiloto';
document.body.appendChild(toast);
}

const nomeIcone=tipo==='sucesso'?'check':(tipo==='alerta'?'alert':'route');
toast.innerHTML=iconeLinha(nomeIcone)+'<span>'+escaparHtmlTexto(textoSemEmoji(mensagem))+'</span>';
toast.className = 'toast-copiloto toast-' + tipo + ' aparecer';

// Reinicia o timer se o usuário disparar outra ação rapidinho em seguida
if(idTimeoutToast) clearTimeout(idTimeoutToast);

idTimeoutToast = setTimeout(()=>{
toast.classList.remove('aparecer');
}, 1600);

}

// ----------------------------------------------------------------------
// V6 - ESTATÍSTICAS DA ROTA
// ----------------------------------------------------------------------

function atualizarEstatisticas(){

const totalParadas = grupos.length;
const todosPacotes = grupos.flatMap(g => g.pacotes);

const pacotesPendentes = todosPacotes.filter(p => p.status === 'pendente').length;
const pacotesEntregues = todosPacotes.filter(p => p.status === 'entregue').length;
const pacotesOcorrencia = todosPacotes.filter(p => p.status === 'ocorrencia').length;

// Os cards de estatística agora mostram quantidade de PACOTES, não de
// paradas - fica mais preciso quando uma parada tem status misto
// (alguns pacotes entregues, outro com ocorrência, no mesmo local).
document.getElementById('qtdPendentes').innerText = pacotesPendentes;
document.getElementById('qtdEntregues').innerText = pacotesEntregues;
document.getElementById('qtdOcorrencias').innerText = pacotesOcorrencia;

// Contadores das abas = mesma base (quantidade de pacotes)
const badgeTab=document.getElementById('badgeOcorrenciasTab'); if(badgeTab){badgeTab.textContent=String(pacotesOcorrencia);badgeTab.style.display='none';}
const resumoSheet=document.getElementById('sheetListaResumo'); if(resumoSheet) resumoSheet.textContent=pacotesPendentes?`${pacotesPendentes} pacote(s) restante(s) · arraste para cima`:'Rota concluída';

const totalPacotes = todosPacotes.length;
const percentual = totalPacotes > 0
? Math.round((pacotesEntregues / totalPacotes) * 100)
: 0;

// Marcos de progresso da rota - avisa uma vez cada quando cruza 25/50/75%
const MARCOS_PROGRESSO = [
{ valor: 25, mensagem: '🚀 25% da rota! Bom começo.' },
{ valor: 50, mensagem: '💪 Metade do caminho!' },
{ valor: 75, mensagem: '🔥 75%! Reta final chegando.' }
];

MARCOS_PROGRESSO.forEach(marco => {
if(percentual >= marco.valor && !marcosMostrados.has(marco.valor)){
marcosMostrados.add(marco.valor);
mostrarToast(marco.mensagem, 'sucesso');
}
});

// Compara com o histórico salvo pra avisar quando bater o recorde do dia
atualizarHistoricoEAvisarRecorde(pacotesEntregues);

const barra = document.getElementById('barraProgresso');
barra.style.width = percentual + '%';
barra.innerText = percentual + '%';
atualizarInformacoesHomeV101(percentual);

// Uma comemoração quando a rota é 100% finalizada 🎉
if(percentual === 100 && totalPacotes > 0){
if(!celebracaoMostrada){
celebracaoMostrada = true;
mostrarToast('🎉 Rota finalizada! Mandou muito bem hoje.', 'sucesso');
}
}else{
celebracaoMostrada = false;
}

}

// Guarda, por dia, o maior número de pacotes entregues naquele dia -
// e avisa (uma vez por rota) quando o dia de hoje supera o melhor dia
// anterior já registrado.
function dataDeHojeChave(){
const d = new Date();
return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function carregarHistoricoEntregas(){
try{
const bruto = localStorage.getItem(HISTORICO_STORAGE_KEY);
return bruto ? JSON.parse(bruto) : {};
}catch(erro){
return {};
}
}

function salvarHistoricoEntregas(historico){
try{
localStorage.setItem(HISTORICO_STORAGE_KEY, JSON.stringify(historico));
}catch(erro){
console.warn("Não foi possível salvar o histórico de entregas:", erro);
}
}

function atualizarHistoricoEAvisarRecorde(pacotesEntreguesHoje){

const historico = carregarHistoricoEntregas();
const hoje = dataDeHojeChave();

const recordeAnterior = Object.keys(historico)
.filter(dia => dia !== hoje)
.reduce((max, dia) => Math.max(max, historico[dia] || 0), 0);

historico[hoje] = Math.max(historico[hoje] || 0, pacotesEntreguesHoje);
salvarHistoricoEntregas(historico);

if(!recordeAvisado && recordeAnterior > 0 && pacotesEntreguesHoje > recordeAnterior){
recordeAvisado = true;
mostrarToast(`🏆 Novo recorde! Hoje já passou seu melhor dia (${recordeAnterior} → ${pacotesEntreguesHoje})`, 'sucesso');
}

}

// ----------------------------------------------------------------------
// V4.2 - PERSISTÊNCIA COM localStorage
// ----------------------------------------------------------------------

function salvarStorage(){
try{
localStorage.setItem(CHAVE_STORAGE, JSON.stringify(grupos));
localStorage.setItem(META_ROTA_STORAGE_KEY, JSON.stringify(metaRota));
}catch(erro){
console.error("Não foi possível salvar a rota localmente:", erro);
}
}

function carregarStorage(){
try{
const salvo = localStorage.getItem(CHAVE_STORAGE);
if(!salvo) return;
grupos = JSON.parse(salvo);

// Migração suave de rotas salvas antes da V7.
grupos.forEach((g,indice)=>{
if(g.stopOriginal === undefined) g.stopOriginal = g.stop;
if(g.ordemOtimizada === undefined) g.ordemOtimizada = null;
if(!Number.isFinite(g.indiceImportacao)) g.indiceImportacao = indice;
(g.pacotes||[]).forEach(p=>{ if(p.organizadoCarro === undefined) p.organizadoCarro = false; });
});

const metaSalva = localStorage.getItem(META_ROTA_STORAGE_KEY);
if(metaSalva){
try{ metaRota = JSON.parse(metaSalva); }catch(erro){}
}
if(metaRota && metaRota.organizacaoPacotesConcluida === undefined) metaRota.organizacaoPacotesConcluida = false;

// V8.1 desativa definitivamente a otimização automática antiga. Rotas salvas
// pelas versões V7 voltam para a ordem original; somente um desenho manual
// V8.1 é preservado ao reabrir o navegador.
if(!metaRota || !['desenho','auto_v9'].includes(metaRota.modo)){
grupos.sort((a,b)=>(a.indiceImportacao ?? 0) - (b.indiceImportacao ?? 0));
grupos.forEach(g=>{ g.ordemOtimizada = null; });
metaRota = {modo:'shopee',provedor:null,distanciaMetros:null,duracaoSegundos:null,distanciaShopeeMetros:null,duracaoShopeeSegundos:null,destinoFinal:null,organizacaoPacotesConcluida:false,atualizadoEm:Date.now()};
try{
localStorage.setItem(CHAVE_STORAGE, JSON.stringify(grupos));
localStorage.setItem(META_ROTA_STORAGE_KEY, JSON.stringify(metaRota));
}catch(erro){}
}

const totalPacotes = grupos.reduce((acc,g)=>acc + g.pacotes.length, 0);
document.getElementById("pacotes").innerText = totalPacotes;

renderizarTudo();
}catch(erro){
console.error("Não foi possível carregar a rota salva:", erro);
}
}

// ----------------------------------------------------------------------
// V5 - MAPA INTEGRADO (Leaflet)
// ----------------------------------------------------------------------

function inicializarMapaSeNecessario(){
if(mapa) return;

mapa = L.map('mapa', {
rotate: true,        // habilita a rotação do mapa
touchRotate: true,    // gira com o gesto de dois dedos no celular
rotateControl: false, // vamos usar nosso próprio botão de bússola
zoomControl: false,   // desliga o padrão (fica em cima da legenda) - recriamos embaixo
bearing: 0
}).setView([-23.5505,-46.6333], 12);

L.control.zoom({ position: 'bottomleft' }).addTo(mapa);

// V10.6: visão geral limpa e troca automática para mapa de ruas nativo no zoom alto.
// Assim o mapa continua leve de longe e fica nítido próximo das entregas.
adicionarMapaBaseLimpoV102(mapa,true);

// Fallback manual de localização: quando ativado pelo ajuste manual, o próximo
// toque no mapa vira a posição do usuário. É útil principalmente no PC,
// onde normalmente não existe GPS e a localização por rede pode ser imprecisa.
mapa.on('click', function(e){
if(modoDesenhoRota) return;
if(!modoAjustePosicaoManual) return;
definirPosicaoManual(e.latlng);
});

instalarEventosDesenhoRota();

}

function ehDispositivoMovelV82(){
try{
if(navigator.userAgentData&&typeof navigator.userAgentData.mobile==='boolean') return navigator.userAgentData.mobile;
}catch(e){}
return /Android|iPhone|iPad|iPod|Mobile/i.test(String(navigator.userAgent||''));
}

function configurarControlesPorDispositivoV82(){
const btn=document.getElementById('botaoAjustarPosicao');
if(btn) btn.style.display=ehDispositivoMovelV82()?'none':'block';
if(ehDispositivoMovelV82()) modoAjustePosicaoManual=false;
}

// Volta o mapa para a orientação normal (norte para cima)
// e pede uma leitura NOVA quando o usuário toca no alvo. Não usamos cache
// nessa ação porque o objetivo aqui é obter a posição mais precisa possível.
function centralizarMinhaLocalizacao(){

if(typeof mapa.setBearing === 'function'){
mapa.setBearing(0);
}

if(localizacaoManualAtiva && meuMarcador){
mapa.setView(meuMarcador.getLatLng(), Math.max(mapa.getZoom(), 17));
mostrarToast(' Usando a posição ajustada manualmente', 'neutro');
return;
}

if(!geolocalizacaoPodeFuncionarAqui()){
atualizarStatusLocalizacao('⚠️ GPS bloqueado neste modo. Abra o Copiloto pelo link HTTPS ou use o ajuste manual.', 'erro');
mostrarToast('⚠️ Arquivo aberto fora de HTTPS: use o link publicado ou ajuste com ', 'alerta');
return;
}

atualizarStatusLocalizacao('🎯 Buscando localização precisa...', 'alerta');
mostrarToast('🎯 Refinando sua localização...', 'neutro');
solicitarLocalizacaoPrecisa(true);
iniciarRastreamentoLocalizacao();
}

function geolocalizacaoPodeFuncionarAqui(){
const protocolo = String(window.location.protocol || '').toLowerCase();
const host = String(window.location.hostname || '').toLowerCase();

// Geolocation do navegador exige contexto seguro. O content:// usado ao
// abrir um HTML vindo do WhatsApp e arquivos locais equivalentes não
// oferecem um contexto confiável para o GPS no Chrome Android.
if(protocolo === 'content:' || protocolo === 'file:') return false;
if(window.isSecureContext) return true;
if(host === 'localhost' || host === '127.0.0.1') return true;
return false;
}

function atualizarStatusLocalizacao(texto, tipo){
const el = document.getElementById('statusLocalizacaoMapa');
if(!el) return;
el.innerHTML = iconeLinha('pin') + '<span>' + escaparHtmlTexto(textoSemEmoji(texto)) + '</span>';
el.className = tipo || '';
}

function mensagemErroGeolocalizacao(erro){
if(!geolocalizacaoPodeFuncionarAqui()){
return 'GPS bloqueado porque o Copiloto foi aberto como arquivo. Abra o link HTTPS publicado ou use o ajuste manual.';
}
if(erro && erro.code === 1) return 'Permissão de localização negada. Libere Localização para este site no navegador.';
if(erro && erro.code === 2) return 'Localização indisponível. Ative o GPS e tente novamente.';
if(erro && erro.code === 3) return 'O GPS demorou para responder. Tente novamente em local aberto.';
return 'Não foi possível obter sua localização agora.';
}

function criarOuAtualizarMarcadorUsuario(lat, lng, precisao, centralizar){

if(!mapa) return;

const icone = L.divIcon({
html: '<div class="pin-usuario"></div>',
className:'',
iconSize:[18,18],
iconAnchor:[9,9]
});

if(!meuMarcador){
meuMarcador = L.marker([lat,lng], {icon:icone, zIndexOffset:1000}).addTo(mapa);
}else{
meuMarcador.setLatLng([lat,lng]);
}

// A margem de erro é importante principalmente no PC: ela mostra visualmente
// quando o navegador só conseguiu estimar a posição por rede/Wi-Fi.
if(Number.isFinite(precisao) && precisao > 0){
if(!circuloPrecisaoUsuario){
circuloPrecisaoUsuario = L.circle([lat,lng], {
radius:precisao,
weight:1,
opacity:.7,
fillOpacity:.08
}).addTo(mapa);
}else{
circuloPrecisaoUsuario.setLatLng([lat,lng]);
circuloPrecisaoUsuario.setRadius(precisao);
}
}else if(circuloPrecisaoUsuario){
mapa.removeLayer(circuloPrecisaoUsuario);
circuloPrecisaoUsuario = null;
}

if(centralizar){
mapa.setView([lat,lng], Math.max(mapa.getZoom(), 17));
}
}

function aplicarPosicaoGeolocalizada(posicao, centralizarForcado){
if(!posicao || !posicao.coords || localizacaoManualAtiva) return;

const lat = Number(posicao.coords.latitude);
const lng = Number(posicao.coords.longitude);
const precisao = Number(posicao.coords.accuracy);
if(!Number.isFinite(lat) || !Number.isFinite(lng)) return;

ultimaPosicaoUsuario = { lat, lng, precisao, timestamp:posicao.timestamp || Date.now() };
precisaoLocalizacaoMetros = Number.isFinite(precisao) ? precisao : null;

let tipo = 'alerta';
let descricaoPrecisao = 'precisão desconhecida';

if(Number.isFinite(precisao)){
const arredondada = Math.max(1, Math.round(precisao));
descricaoPrecisao = `±${arredondada} m`;
if(precisao <= 30) tipo = 'ok';
else if(precisao <= 100) tipo = 'alerta';
else tipo = 'erro';
}

atualizarStatusLocalizacao(`📍 GPS ${descricaoPrecisao}${precisao > 100 ? ' — baixa precisão' : ''}`, tipo);

// Na primeira leitura automática só centraliza sozinha quando já temos uma
// precisão razoável. Assim o mapa não "salta" para uma estimativa grosseira
// do PC e depois precisa voltar quando o GPS refina.
const deveCentralizar = !!centralizarForcado || (!primeiraCentralizacaoGPSFeita && (!Number.isFinite(precisao) || precisao <= 80));
criarOuAtualizarMarcadorUsuario(lat, lng, precisao, deveCentralizar);

if(deveCentralizar) primeiraCentralizacaoGPSFeita = true;
}

function solicitarLocalizacaoPrecisa(centralizarAoObter){

if(!navigator.geolocation || !geolocalizacaoPodeFuncionarAqui()) return;

navigator.geolocation.getCurrentPosition(
function(posicao){
aplicarPosicaoGeolocalizada(posicao, !!centralizarAoObter);

const precisao = Number(posicao.coords && posicao.coords.accuracy);
if(Number.isFinite(precisao) && precisao <= 30){
mostrarToast(`✅ Localização precisa: ±${Math.round(precisao)} m`, 'sucesso');
}else if(Number.isFinite(precisao)){
mostrarToast(`📍 Precisão atual: ±${Math.round(precisao)} m`, precisao <= 100 ? 'neutro' : 'alerta');
}
},
function(erro){
const mensagem = mensagemErroGeolocalizacao(erro);
atualizarStatusLocalizacao('⚠️ ' + mensagem, 'erro');
mostrarToast('⚠️ ' + mensagem, 'alerta');
},
{
enableHighAccuracy:true,
maximumAge:0,
timeout:30000
}
);
}

// Mostra a localização do usuário no mapa e vai atualizando conforme ele anda.
// maximumAge=0 evita reutilizar uma posição antiga e enableHighAccuracy pede GPS
// sempre que o aparelho tiver esse recurso disponível.
function iniciarRastreamentoLocalizacao(){

if(localizacaoManualAtiva) return;

if(!navigator.geolocation){
atualizarStatusLocalizacao('⚠️ Este navegador não oferece geolocalização. Use .', 'erro');
return;
}

if(!geolocalizacaoPodeFuncionarAqui()){
atualizarStatusLocalizacao('⚠️ GPS bloqueado neste modo. Abra pelo link HTTPS ou use o ajuste manual.', 'erro');
return;
}

if(idRastreamento !== null) return; // já está rastreando

atualizarStatusLocalizacao('📍 Aguardando sinal do GPS...', 'alerta');

idRastreamento = navigator.geolocation.watchPosition(
function(posicao){
aplicarPosicaoGeolocalizada(posicao, false);
},
function(erro){
const mensagem = mensagemErroGeolocalizacao(erro);
console.warn('Não foi possível obter a localização:', mensagem);
atualizarStatusLocalizacao('⚠️ ' + mensagem, 'erro');
},
{
enableHighAccuracy:true,
maximumAge:0,
timeout:30000
}
);
}

function alternarAjustePosicaoManual(){

if(ehDispositivoMovelV82()) return;
const botao = document.getElementById('botaoAjustarPosicao');

// Se já está usando uma posição manual, o mesmo botão volta para o GPS.
if(localizacaoManualAtiva){
localizacaoManualAtiva = false;
modoAjustePosicaoManual = false;
if(botao) botao.classList.remove('ativo');
primeiraCentralizacaoGPSFeita = false;
atualizarStatusLocalizacao('📍 Voltando para o GPS...', 'alerta');
mostrarToast('📍 Voltando para a localização automática', 'neutro');
solicitarLocalizacaoPrecisa(true);
iniciarRastreamentoLocalizacao();
return;
}

modoAjustePosicaoManual = !modoAjustePosicaoManual;
if(botao) botao.classList.toggle('ativo', modoAjustePosicaoManual);

if(modoAjustePosicaoManual){
atualizarStatusLocalizacao(' Toque no ponto exato onde você está', 'alerta');
mostrarToast(' Agora toque no seu ponto exato no mapa', 'neutro');
}else{
atualizarStatusLocalizacao('📍 Ajuste manual cancelado', 'alerta');
}
}

function definirPosicaoManual(latlng){
if(!latlng) return;

localizacaoManualAtiva = true;
modoAjustePosicaoManual = false;
precisaoLocalizacaoMetros = 0;
ultimaPosicaoUsuario = { lat:latlng.lat, lng:latlng.lng, precisao:0, timestamp:Date.now() };

const botao = document.getElementById('botaoAjustarPosicao');
if(botao) botao.classList.add('ativo');

if(circuloPrecisaoUsuario){
mapa.removeLayer(circuloPrecisaoUsuario);
circuloPrecisaoUsuario = null;
}

criarOuAtualizarMarcadorUsuario(latlng.lat, latlng.lng, null, true);
atualizarStatusLocalizacao(' Posição ajustada manualmente', 'ok');
mostrarToast('✅ Posição manual definida. Toque no ajuste manual de novo para voltar ao GPS.', 'sucesso');
}

function corPorStatus(status){
if(status === 'entregue') return '#9ca3af';
if(status === 'ocorrencia') return '#e74c3c';
return '#003CBD'; // azul padrão do Copiloto
}

// ----- Painel inferior (bottom sheet) ao clicar num pin do mapa -----

function conteudoInfoHtml(grupo){

return `
<h3 style="margin:0;">${tituloParada(grupo)}</h3>
${grupo.destinatario ? `<div class="nome-destinatario">${iconeLinha('user')} ${primeiroNome(grupo.destinatario)}</div>` : ''}
<div class="endereco">${grupo.endereco}</div>
${htmlReferenciaRota(grupo)}
<div class="badge">${grupo.pacotes.length} pacote(s) neste local</div>
${badgeStatusGrupoHtml(grupo)}

<button class="waze" onclick="abrirWaze('${grupo.lat}','${grupo.lng}')">${iconeLinha('waze')} Abrir no Waze</button>
<button class="toggle" onclick="verNaLista('${grupo.id}')">${iconeLinha('home')} Ver na lista</button>
<button class="toggle" onclick="verificarLocalizacaoPin('${grupo.id}')">${iconeLinha('search')} Verificar localização</button>

<div class="btn-linha">
<button class="entregue-btn" onclick="acaoNoPainelInfo('${grupo.id}','entregue')">${iconeLinha('check')} Entregue</button>
<button class="ocorrencia-btn" onclick="acaoNoPainelInfo('${grupo.id}','ocorrencia')">${iconeLinha('alert')} Ocorrência</button>
<button class="desfazer-btn" onclick="acaoNoPainelInfo('${grupo.id}','desfazer')">${iconeLinha('undo')} Desfazer</button>
</div>
`;
}

let marcadorSelecionadoId = null;

function abrirInfoMapa(id){
const grupo = encontrarGrupo(id);
if(!grupo) return;
document.getElementById('conteudoInfoMapa').innerHTML = conteudoInfoHtml(grupo);
document.getElementById('fundoInfoMapa').classList.add('aberto');
document.getElementById('painelInfoMapa').classList.add('aberto');
destacarMarcador(id);
}

function fecharInfoMapa(){
document.getElementById('fundoInfoMapa').classList.remove('aberto');
document.getElementById('painelInfoMapa').classList.remove('aberto');
destacarMarcador(null);
}

// Dá destaque visual ao marcador da parada selecionada (maior, com anel
// laranja), tirando o destaque do que estava selecionado antes.
function destacarMarcador(id){

if(marcadorSelecionadoId && marcadores[marcadorSelecionadoId]){
const elAnterior = marcadores[marcadorSelecionadoId].getElement();
const pinAnterior = elAnterior ? elAnterior.querySelector('.pin-mapa') : null;
if(pinAnterior) pinAnterior.classList.remove('marcador-selecionado');
marcadores[marcadorSelecionadoId].setZIndexOffset(0);
}

marcadorSelecionadoId = id;

if(id && marcadores[id]){
const el = marcadores[id].getElement();
const pin = el ? el.querySelector('.pin-mapa') : null;
if(pin) pin.classList.add('marcador-selecionado');
marcadores[id].setZIndexOffset(1000);
}

}

// ----------------------------------------------------------------------
// CLIQUE "INTELIGENTE" NO MAPA: quando há paradas muito próximas/
// sobrepostas na tela, cliques repetidos no mesmo ponto ciclam entre
// elas, em vez de sempre reabrir a mesma parada de cima.
// ----------------------------------------------------------------------

const RAIO_CICLO_PIXELS = 24;
let estadoCicloClique = { ponto:null, indice:0 };

function aoClicarMarcador(grupoIdClicado, evento){

const pontoClique = mapa.mouseEventToContainerPoint(evento.originalEvent);

// Todos os marcadores cujo ícone está perto (na tela) do ponto clicado
const candidatos = Object.keys(marcadores)
.map(id => ({ id, ponto: mapa.latLngToContainerPoint(marcadores[id].getLatLng()) }))
.filter(m => pontoClique.distanceTo(m.ponto) <= RAIO_CICLO_PIXELS)
.sort((a,b) => pontoClique.distanceTo(a.ponto) - pontoClique.distanceTo(b.ponto));

if(candidatos.length <= 1){
estadoCicloClique = { ponto:null, indice:0 };
abrirInfoMapa(grupoIdClicado);
return;
}

const cliqueNoMesmoPonto = estadoCicloClique.ponto &&
pontoClique.distanceTo(estadoCicloClique.ponto) <= RAIO_CICLO_PIXELS;

estadoCicloClique.indice = cliqueNoMesmoPonto
? (estadoCicloClique.indice + 1) % candidatos.length
: 0;

estadoCicloClique.ponto = pontoClique;

abrirInfoMapa(candidatos[estadoCicloClique.indice].id);

}

// Ações disparadas de dentro do painel inferior do mapa
function acaoNoPainelInfo(id, acao){
if(acao === 'entregue') marcarEntregueSemExcecao(id);
if(acao === 'ocorrencia'){ fecharInfoMapa(); abrirModalMotivo(id); return; }
if(acao === 'desfazer') desfazerStatus(id);
fecharInfoMapa();
}

// Leva o usuário até o card da parada na aba Lista (ou Ocorrências, se for o caso)
function verNaLista(id){
const grupo = encontrarGrupo(id);
if(!grupo) return;

fecharInfoMapa();

irParaAba(1);
definirSheetListaMapa(true);
setTimeout(()=> destacarElemento('grupo_' + id), 260);
}

function destacarElemento(elementId){
const el = document.getElementById(elementId);
if(!el) return;
el.scrollIntoView({behavior:'smooth', block:'center'});
el.classList.add('destaque-temporario');
setTimeout(()=> el.classList.remove('destaque-temporario'), 1600);
}

let ocultarEntreguesMapa = false;
let painelPacotesAbertos = new Set(); // ids das listas de pacotes que o usuário deixou abertas

function atualizarResumoMapa(){
const todosPacotes = grupos.flatMap(g => g.pacotes);
const pendentes = todosPacotes.filter(p => p.status === 'pendente').length;
const ocorrencias = todosPacotes.filter(p => p.status === 'ocorrencia').length;
document.getElementById('resumoMapaTexto').innerText = pendentes + ' pendente(s)';
document.getElementById('resumoMapaOcorrencias').innerText = ocorrencias + ' ocorrência(s)';
}

// Esconde/mostra os pins já entregues no mapa, pra desafogar a
// visualização numa rota com muita parada
function alternarOcultarEntreguesMapa(){
ocultarEntreguesMapa = !ocultarEntreguesMapa;
document.getElementById('botaoOcultarEntregues').classList.toggle('ativo', ocultarEntreguesMapa);
atualizarMapa();
}

// Busca uma parada pelo número e leva o mapa até ela, destacando o pin
// Abre/fecha o campo de busca (fica escondido por padrão pra não
// atrapalhar a visualização do mapa)
function alternarBuscaMapa(){
const painel = document.getElementById('painelBuscaMapa');
const abrindo = !painel.classList.contains('aberto');
painel.classList.toggle('aberto', abrindo);
if(abrindo){
setTimeout(()=> document.getElementById('buscaParadaMapa').focus(), 100);
}
}

function buscarParadaNoMapa(){

const valor = document.getElementById('buscaParadaMapa').value.trim();
if(!valor) return;

const grupo = grupos.find(g => temOrdemOtimizada(g) && String(g.ordemOtimizada) === valor)
|| grupos.find(g => ehStopValido(g.stop) && String(g.stop) === valor);

if(!grupo){
mostrarToast('⚠️ Parada não encontrada', 'alerta');
return;
}

const lat = parseFloat(grupo.lat);
const lng = parseFloat(grupo.lng);

if(isNaN(lat) || isNaN(lng)){
mostrarToast('⚠️ Essa parada não tem coordenada válida', 'alerta');
return;
}

mapa.setView([lat, lng], Math.max(mapa.getZoom(), 17));
destacarMarcador(grupo.id);
document.getElementById('buscaParadaMapa').value = '';
document.getElementById('buscaParadaMapa').blur();
document.getElementById('painelBuscaMapa').classList.remove('aberto');

}

function atualizarMapa(){

if(!mapa) return;

Object.values(marcadores).forEach(m => mapa.removeLayer(m));
marcadores = {};

const pontosValidos = [];

grupos.forEach(grupo=>{

const lat = parseFloat(grupo.lat);
const lng = parseFloat(grupo.lng);
if(isNaN(lat) || isNaN(lng)) return;

const statusGrupo = statusEfetivoGrupo(grupo);

// Oculta pins totalmente entregues quando o filtro estiver ativo
if(ocultarEntreguesMapa && statusGrupo === 'entregue') return;

const rotulo = temOrdemOtimizada(grupo)
? grupo.ordemOtimizada
: (ehStopValido(grupo.stop) ? grupo.stop : '★');
const tamanhoNumeroPin = String(rotulo).length >= 3 ? '8px' : '10px';

const icone = L.divIcon({
html: `<div class="pin-mapa" style="color:${corPorStatus(statusGrupo)}"><div class="pin-corpo"><span style="font-size:${tamanhoNumeroPin}">${rotulo}</span></div></div>`,
className:'',
iconSize:[25,34],
iconAnchor:[12.5,34],
popupAnchor:[0,-34]
});

const marcador = L.marker([lat,lng], {icon: icone}).addTo(mapa);
marcador.on('click', function(e){ aoClicarMarcador(grupo.id, e); });
marcadores[grupo.id] = marcador;

pontosValidos.push([lat,lng]);

});

// V8.0: mostra o traço manual salvo como referência visual.
atualizarLinhaRotaManualNoMapa();

// Endereço final escolhido no modo legado “Terminar perto de...”
if(marcadorDestinoRota){
mapa.removeLayer(marcadorDestinoRota);
marcadorDestinoRota = null;
}
if(metaRota && metaRota.destinoFinal &&
Number.isFinite(Number(metaRota.destinoFinal.lat)) && Number.isFinite(Number(metaRota.destinoFinal.lng))){
const iconeDestino = L.divIcon({
html:'<div class="pin-destino-final">'+iconeLinha('flag')+'</div>',
className:'',
iconSize:[30,30],
iconAnchor:[15,15]
});
marcadorDestinoRota = L.marker([Number(metaRota.destinoFinal.lat), Number(metaRota.destinoFinal.lng)], {icon:iconeDestino, zIndexOffset:900}).addTo(mapa);
marcadorDestinoRota.bindTooltip('Destino final: ' + metaRota.destinoFinal.texto);
pontosValidos.push([Number(metaRota.destinoFinal.lat), Number(metaRota.destinoFinal.lng)]);
}

if(pontosValidos.length > 0 && !mapaFoiEnquadrado){
mapa.fitBounds(pontosValidos, {padding:[30,30]});
mapaFoiEnquadrado = true;
}

atualizarResumoMapa();
if(modoDesenhoRota) setTimeout(()=>atualizarDestaqueFaltantesDesenhoV82(),0);

}


// ----------------------------------------------------------------------
// V10.1 - PREFERÊNCIAS DO APP
// ----------------------------------------------------------------------
const CONFIG_V10_KEY='copiloto_entrega_config_v10_1';
let wakeLockV10=null;
function carregarPreferenciasV10(){
let cfg={ocultarEntregues:false,sheetDesktop:true,telaAtiva:false};
try{const bruto=localStorage.getItem(CONFIG_V10_KEY);if(bruto)cfg={...cfg,...JSON.parse(bruto)};}catch(e){}
ocultarEntreguesMapa=!!cfg.ocultarEntregues;
const btn=document.getElementById('botaoOcultarEntregues');if(btn)btn.classList.toggle('ativo',ocultarEntreguesMapa);
const a=document.getElementById('configOcultarEntreguesV10');if(a)a.checked=!!cfg.ocultarEntregues;
const b=document.getElementById('configSheetDesktopV10');if(b)b.checked=cfg.sheetDesktop!==false;
const c=document.getElementById('configTelaAtivaV10');if(c)c.checked=!!cfg.telaAtiva;
if(!ehLayoutMobileV10()&&cfg.sheetDesktop!==false) definirSheetListaMapa(false);
if(cfg.telaAtiva) solicitarWakeLockV10();
atualizarResumoSettingsV10();
return cfg;
}
function salvarPreferenciasV10(patch){
let atual={ocultarEntregues:false,sheetDesktop:true,telaAtiva:false};
try{const bruto=localStorage.getItem(CONFIG_V10_KEY);if(bruto)atual={...atual,...JSON.parse(bruto)};}catch(e){}
const novo={...atual,...patch};
try{localStorage.setItem(CONFIG_V10_KEY,JSON.stringify(novo));}catch(e){}
return novo;
}
function alternarConfigOcultarEntreguesV10(valor){
ocultarEntreguesMapa=!!valor;salvarPreferenciasV10({ocultarEntregues:!!valor});
const btn=document.getElementById('botaoOcultarEntregues');if(btn)btn.classList.toggle('ativo',ocultarEntreguesMapa);
if(mapa)atualizarMapa();
}
function alternarConfigSheetDesktopV10(valor){
salvarPreferenciasV10({sheetDesktop:!!valor});
if(!ehLayoutMobileV10()&&!valor) definirSheetListaMapa(false);
}
async function solicitarWakeLockV10(){
if(!('wakeLock' in navigator)||document.visibilityState!=='visible')return;
try{wakeLockV10=await navigator.wakeLock.request('screen');}catch(e){wakeLockV10=null;}
}
async function liberarWakeLockV10(){try{if(wakeLockV10)await wakeLockV10.release();}catch(e){}wakeLockV10=null;}
function alternarConfigTelaAtivaV10(valor){
salvarPreferenciasV10({telaAtiva:!!valor});
if(valor)solicitarWakeLockV10();else liberarWakeLockV10();
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){let cfg={};try{cfg=JSON.parse(localStorage.getItem(CONFIG_V10_KEY)||'{}');}catch(e){}if(cfg.telaAtiva)solicitarWakeLockV10();}});
function atualizarResumoSettingsV10(){
const cfg=carregarConfiguracaoV9();
const el=document.getElementById('settingsResumoOtimizacao');
if(el)el.textContent=cfg.modo==='nenhuma'?'Não otimizar':(cfg.modo==='destino'&&pontoValido(cfg.destinoFinal)?`Terminar próximo: ${textoDestinoCurtoV9(cfg.destinoFinal)}`:'Scanner por regiões');
}
function atualizarInformacoesHomeV101(percentual){
const p=document.getElementById('homeInsightProgresso');if(p)p.textContent=`${Number.isFinite(percentual)?percentual:0}%`;
const restantes=grupos.filter(g=>statusEfetivoGrupo(g)!=='entregue');
const r=document.getElementById('homeInsightParadas');if(r)r.textContent=String(restantes.length);
const pendentes=grupos.filter(g=>g.pacotes.some(p=>p.status==='pendente')).slice().sort((a,b)=>{
 const oa=temOrdemOtimizada(a)?Number(a.ordemOtimizada):(ehStopValido(a.stop)?Number(a.stop):999999);
 const ob=temOrdemOtimizada(b)?Number(b.ordemOtimizada):(ehStopValido(b.stop)?Number(b.stop):999999);
 return oa-ob;
});
const prox=pendentes[0];
const n=prox?(temOrdemOtimizada(prox)?prox.ordemOtimizada:(ehStopValido(prox.stop)?prox.stop:'Extra')):null;
const el=document.getElementById('homeInsightProxima');if(el)el.textContent=n?`#${n}`:'—';
}

// ----------------------------------------------------------------------
// NAVEGAÇÃO POR ABAS (Home / Mapa / Configurações)
// ----------------------------------------------------------------------

const painéis = ['painelLista','painelMapa','painelOcorrencias'];
const botõesAba = ['btnAbaLista','btnAbaMapa','btnAbaOcorrencias'];

function irParaAba(indice){

if(indice < 0) indice = 0;
if(indice > 2) indice = 2;

abaAtual = indice;

painéis.forEach((idPainel, i)=>{
document.getElementById(idPainel).classList.toggle('ativo', i === indice);
});

botõesAba.forEach((idBtn, i)=>{
document.getElementById(idBtn).classList.toggle('ativa', i === indice);
});

// Ao entrar na aba do mapa, garante que ele já existe e recalcula o
// tamanho (necessário porque ele estava com display:none)
if(indice === 1){
inicializarMapaSeNecessario();
iniciarGestosSheetListaMapa();
iniciarRastreamentoLocalizacao();
if(ehLayoutMobileV10()) definirSheetListaMapa(false);
else {let cfg={sheetDesktop:true};try{cfg={...cfg,...JSON.parse(localStorage.getItem(CONFIG_V10_KEY)||'{}')};}catch(e){}if(cfg.sheetDesktop===false) definirSheetListaMapa(false);}
setTimeout(()=>{
mapa.invalidateSize();
atualizarMapa();
}, 100);
}
if(indice===2){carregarPreferenciasV10();atualizarResumoSettingsV10();}

}

// ----------------------------------------------------------------------
// UM POUCO DE PERSONALIDADE 🚚
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
// SOM DE CONFIRMAÇÃO (opcional, com botão pra silenciar)
// ----------------------------------------------------------------------

let somAtivado = true;
let contextoAudio = null;

function carregarPreferenciaSom(){
try{
const salvo = localStorage.getItem(SOM_STORAGE_KEY);
somAtivado = salvo === null ? true : salvo === 'true';
}catch(erro){
somAtivado = true;
}
atualizarIconeSom();
}

function alternarSom(){
somAtivado = !somAtivado;
try{ localStorage.setItem(SOM_STORAGE_KEY, String(somAtivado)); }catch(erro){}
atualizarIconeSom();
if(somAtivado) tocarSomEntrega(); // dá um exemplo do som ao ligar
}

function atualizarIconeSom(){
const botao = document.getElementById('botaoSom');
if(botao) botao.innerHTML=iconeLinha('settings');
}

// Toca um "ding" curtinho sintetizado (sem precisar de arquivo de áudio)
function tocarSomEntrega(){

if(!somAtivado) return;

try{

if(!contextoAudio){
contextoAudio = new (window.AudioContext || window.webkitAudioContext)();
}

const agora = contextoAudio.currentTime;

// Duas notas rápidas subindo, tipo um "ding" de confirmação
[ {freq:880, inicio:0}, {freq:1318.5, inicio:0.08} ].forEach(nota=>{

const osc = contextoAudio.createOscillator();
const ganho = contextoAudio.createGain();

osc.type = 'sine';
osc.frequency.value = nota.freq;

ganho.gain.setValueAtTime(0.0001, agora + nota.inicio);
ganho.gain.exponentialRampToValueAtTime(0.2, agora + nota.inicio + 0.01);
ganho.gain.exponentialRampToValueAtTime(0.0001, agora + nota.inicio + 0.25);

osc.connect(ganho);
ganho.connect(contextoAudio.destination);

osc.start(agora + nota.inicio);
osc.stop(agora + nota.inicio + 0.3);

});

}catch(erro){
console.warn("Não foi possível tocar o som de confirmação:", erro);
}

}

function aplicarSaudacao(){

const hora = new Date().getHours();
let frases;

if(hora >= 5 && hora < 12){
frases = [
"Bom dia! Vamos nessa 🚀",
"Bom dia! Café tomado, rota na mão ☕",
"Bora começar antes que o sol esquente 🌤️",
"Dia novo, rota nova. Foco no trajeto 🧭",
"Bom dia! Bora fazer essa rota render 🚚"
];
}else if(hora >= 12 && hora < 18){
frases = [
"Boa tarde! Só mais um pouco 💪",
"Boa tarde! Bora manter o ritmo 🔥",
"Metade do dia já foi, segue o fluxo 🚚",
"Boa tarde! Hidrata e continua firme 💧",
"Ritmo bom, entregador. Segue assim"
];
}else{
frases = [
"Boa noite! Reta final 🌙",
"Boa noite! Já deu pra hoje, quase lá 🌙",
"Últimas entregas do dia, capricha 🌆",
"Boa noite! Farol ligado e foco na via 🚗💡",
"Fechando o dia com estilo 🌙"
];
}

const saudacao=document.getElementById('saudacaoHeader'); if(saudacao) saudacao.innerText=textoSemEmoji(frases[Math.floor(Math.random()*frases.length)]);

}

/* Otimização por regiões contíguas: uma região é concluída antes da próxima.
   Não usa linha reta como custo de deslocamento: a matriz viária é direcional. */
const ScannerRegioes=(()=>{
'use strict';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
function geo(a,b){
  if([a.lat,a.lng,b.lat,b.lng].some(x=>x===null||x===undefined||String(x).trim()===''||!Number.isFinite(Number(x))))return Infinity;
  const rad=Math.PI/180,lat=(Number(a.lat)+Number(b.lat))/2*rad;
  return Math.hypot((Number(a.lng)-Number(b.lng))*rad*Math.cos(lat), (Number(a.lat)-Number(b.lat))*rad)*6371000;
}
function groups(stops,matrix){
  const blocks=[],known=new Map(),unknown=[];
  stops.forEach((g,k)=>{
    const label=String(g.v11?.region||g.bairro||'').trim();
    const key=label?norm(g.cidade)+'|'+norm(label):'';
    if(key){if(!known.has(key)){const b={id:blocks.length,label,explicit:true,members:[]};known.set(key,b);blocks.push(b);}known.get(key).members.push(k+1);}
    else unknown.push(k+1);
  });
  // Pontos sem bairro só se juntam quando próximos também pelas ruas.
  // Diâmetro limitado impede uma cadeia de vizinhos de atravessar a cidade.
  const near=(i,j)=>{
    const d=geo(stops[i-1],stops[j-1]);
    const road=Math.min(matrix.distancias[i]?.[j]??Infinity,matrix.distancias[j]?.[i]??Infinity);
    return d<=900&&road<=Math.max(450,d*2.5)&&road<=1800;
  };
  const compatible=(a,b)=>a.every(i=>b.every(j=>geo(stops[i-1],stops[j-1])<=2500&&(!norm(stops[i-1].cidade)||!norm(stops[j-1].cidade)||norm(stops[i-1].cidade)===norm(stops[j-1].cidade))));
  const auto=unknown.map(i=>({id:-1,label:'',explicit:false,members:[i]}));
  const edges=[];
  for(let a=0;a<unknown.length;a++)for(let b=a+1;b<unknown.length;b++)if(near(unknown[a],unknown[b]))edges.push([unknown[a],unknown[b],geo(stops[unknown[a]-1],stops[unknown[b]-1])]);
  edges.sort((a,b)=>a[2]-b[2]||a[0]-b[0]||a[1]-b[1]);
  for(const [i,j]of edges){const a=auto.find(b=>b.members.includes(i)),b=auto.find(b=>b.members.includes(j));if(a!==b&&compatible(a.members,b.members)){a.members.push(...b.members);auto.splice(auto.indexOf(b),1);}}
  // Vincula um bloco sem nome a um bairro conhecido somente se todo o bloco
  // ficar compacto e houver conexão próxima pela matriz das ruas.
  for(const a of auto){
    const choices=blocks.filter(b=>compatible(a.members,b.members)&&a.members.some(i=>b.members.some(j=>near(i,j))));
    choices.sort((b,c)=>Math.min(...a.members.flatMap(i=>b.members.map(j=>geo(stops[i-1],stops[j-1]))))-Math.min(...a.members.flatMap(i=>c.members.map(j=>geo(stops[i-1],stops[j-1])))));
    if(choices.length)choices[0].members.push(...a.members);else blocks.push(a);
  }
  blocks.forEach((b,i)=>{b.id=i;if(!b.label)b.label='Região '+(i+1);b.deferred=b.members.some(j=>stops[j-1].v11?.deferred);});
  return blocks;
}
function paths(block,stops,matrix,forced){
  const out=[],seen=new Set();
  function add(p){if(forced&&p[0]!==forced)return;const key=p.join(',');if(!seen.has(key)){seen.add(key);out.push(p);}}
  const members=block.members;
  const starts=forced?[forced]:[...members].sort((a,b)=>matrix.duracoes[0][a]-matrix.duracoes[0][b]).slice(0,8);
  for(const start of starts){
    const p=[start],left=new Set(members.filter(i=>i!==start));
    while(left.size){const prev=p.at(-1);const next=[...left].sort((a,b)=>matrix.duracoes[prev][a]-matrix.duracoes[prev][b]||a-b)[0];p.push(next);left.delete(next);}add(p);if(!forced)add([...p].reverse());
  }
  // Candidatas de varredura em faixas, nos dois sentidos e quatro orientações.
  const ref=stops[members[0]-1],cos=Math.cos(Number(ref.lat)*Math.PI/180);
  if(members.every(i=>Number.isFinite(geo(ref,stops[i-1]))))for(const angle of [0,Math.PI/4,Math.PI/2,3*Math.PI/4]){
    const points=members.map(i=>{const g=stops[i-1],x=(g.lng-ref.lng)*111320*cos,y=(g.lat-ref.lat)*111320;return {i,u:x*Math.cos(angle)+y*Math.sin(angle),v:-x*Math.sin(angle)+y*Math.cos(angle)};});
    const min=Math.min(...points.map(p=>p.v));
    points.forEach(p=>p.band=Math.floor((p.v-min)/140));
    points.sort((a,b)=>a.band-b.band||(a.band%2?b.u-a.u:a.u-b.u));
    const p=points.map(p=>p.i);add(p);add([...p].reverse());
  }
  return out;
}
function compare(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){if(a[i]===b[i])continue;return (a[i]??0)<(b[i]??0)?-1:1;}return 0;}
async function solve(indices,matrix,stops,next,startAt,evaluate){
  const blocks=groups(stops,matrix),forced=indices.find(i=>stops[i-1].id===next),first=blocks.find(b=>b.members.includes(forced));
  const variants=new Map(blocks.map(b=>[b.id,paths(b,stops,matrix,b===first?forced:null)]));
  const orderedBlocks=p=>{
    const ids=[...new Set(p.map(i=>blocks.find(b=>b.members.includes(i)).id))];
    return ids.filter(i=>i===first?.id).concat(ids.filter(i=>i!==first?.id&&!blocks[i].deferred),ids.filter(i=>i!==first?.id&&blocks[i].deferred));
  };
  const seeds=[],seen=new Set();
  const add=p=>{const c=orderedBlocks(p),key=c.join(',');if(!seen.has(key)){seen.add(key);seeds.push(c);}};
  add(indices);add([...indices].reverse());
  const starts=first?[first]:[...blocks].sort((a,b)=>Math.min(...a.members.map(i=>matrix.duracoes[0][i]))-Math.min(...b.members.map(i=>matrix.duracoes[0][i]))).slice(0,8);
  for(const start of starts){
    const left=blocks.filter(b=>b!==start),order=[start];
    while(left.length){const prev=order.at(-1);left.sort((a,b)=>Math.min(...prev.members.flatMap(i=>a.members.map(j=>matrix.duracoes[i][j])))-Math.min(...prev.members.flatMap(i=>b.members.map(j=>matrix.duracoes[i][j]))));order.push(left.shift());}
    add(order.flatMap(b=>b.members));add([...order].reverse().flatMap(b=>b.members));
  }
  function expand(sequence){
    let p=[];
    sequence.forEach((id,k)=>{
      const nextBlock=blocks[sequence[k+1]];
      let chosen=null,score=null;
      for(const candidate of variants.get(id)){
        const e=evaluate([...p,...candidate],matrix,stops,startAt);
        // Avaliação da saída real rumo ao próximo bloco; destino final já
        // faz parte da avaliação completa da última região.
        const last=candidate.at(-1),tail=matrix.indiceDestinoFinalV9;
        const exit=nextBlock?Math.min(...nextBlock.members.map(j=>matrix.duracoes[last][j])):0;
        const s=e.score.slice();if(nextBlock&&Number.isFinite(s[4]))s[4]+=exit-(Number.isInteger(tail)?matrix.duracoes[last][tail]:0);
        if(!score||compare(s,score)<0){score=s;chosen=candidate;}
      }
      p.push(...chosen);
    });
    return {order:p,metrics:evaluate(p,matrix,stops,startAt),sequence};
  }
  let best=null;
  for(const s of seeds){const c=expand(s);if(!best||compare(c.metrics.score,best.metrics.score)<0)best=c;}
  // Só move blocos completos. Nunca permite A -> B -> A para economizar segundos.
  const until=performance.now()+1500;let iterations=0;
  for(let round=0;round<2&&performance.now()<until;round++){
    let improved=false;
    for(let i=0;i<blocks.length&&performance.now()<until;i++)for(let j=0;j<blocks.length&&performance.now()<until;j++){
      if(i===j)continue;
      const sequence=best.sequence.slice();sequence.splice(j,0,sequence.splice(i,1)[0]);
      const canonical=orderedBlocks(sequence.flatMap(id=>blocks[id].members));if(canonical.some((v,k)=>v!==sequence[k]))continue;
      const candidate=expand(sequence);if(compare(candidate.metrics.score,best.metrics.score)<0){best=candidate;improved=true;}
      if(++iterations%30===0)await new Promise(r=>setTimeout(r,0));
    }
    if(!improved)break;
  }
  if(new Set(best.order).size!==indices.length||best.order.length!==indices.length)throw new Error('Não foi possível preservar todas as paradas.');
  return {...best,blocks:best.sequence.map(id=>blocks[id])};
}
return {groups,solve};
})();

/* Copiloto Entrega V11 — extensão local, sem conta ou envio automático. */
const CE11 = (() => {
'use strict';
const KEY='copiloto_v11_snapshot', MEMORY='copiloto_v11_enderecos';
let revision=0,busy=false,dbPromise=null,saveQueue=Promise.resolve(),selected=null;
let scannerToken=0,scannerControls=null,photoUrls=[],storageWarned=false;
let memories={};
try{memories=JSON.parse(localStorage.getItem(MEMORY)||'{}');}catch(e){}
const esc=escaparHtmlTexto;
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const pending=g=>g.pacotes.some(p=>p.status==='pendente');
const opts=g=>g.v11||(g.v11={});
const route=()=>metaRota.v11||(metaRota.v11={id:uid(),events:[],next:null,pauseUntil:0});
const clock=t=>new Date(t).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
const timeInput=n=>Number.isFinite(n)?String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0'):'';
const parseTime=s=>/^\d\d:\d\d$/.test(s)?Number(s.slice(0,2))*60+Number(s.slice(3)):null;
function normal(s){return normalizarTexto(String(s||'')).replace(/\s+/g,' ').trim();}
function memoryKey(g){return [normal(normalizarConsultaGeocodificacao(g.endereco)),normal(g.cidade),normal(g.cep)].join('|');}
function ensure(){
  route();
  grupos.forEach(g=>{opts(g);g.pacotes.forEach(p=>{p.uid11=p.uid11||uid();if(p.lastStatus11===undefined)p.lastStatus11=p.status;});});
}
function db(){
  if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
    const r=indexedDB.open('copiloto-v11',1);
    r.onupgradeneeded=()=>{r.result.createObjectStore('state');r.result.createObjectStore('photos');};
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  return dbPromise;
}
async function store(name,key,value){
  const d=await db();
  return new Promise((resolve,reject)=>{
    const t=d.transaction(name,value===undefined?'readonly':'readwrite');
    const r=value===undefined?t.objectStore(name).get(key):t.objectStore(name).put(value,key);
    t.oncomplete=()=>resolve(r.result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('Não foi possível salvar.'));
  });
}
function snapshot(){ensure();return {version:11,savedAt:Date.now(),grupos,metaRota,memories};}
function validSnapshot(s){
  if(!s||s.version!==11||!Array.isArray(s.grupos)||!s.metaRota||typeof s.metaRota!=='object'||Array.isArray(s.metaRota))return false;
  const ids=new Set(),packages=new Set();
  return s.grupos.length<=10000&&s.grupos.every(g=>{
    if(!g||typeof g.id!=='string'||!/^[\p{L}\p{N}|# ._-]+$/u.test(g.id)||ids.has(g.id)||!Array.isArray(g.pacotes)||!g.pacotes.length)return false;
    if([g.endereco,g.destinatario,g.stop].some(v=>v!=null&&(/[<>]/.test(String(v))||typeof v==='object')))return false;
    ids.add(g.id);
    return g.pacotes.every(p=>{
      if(!p||!['pendente','entregue','ocorrencia'].includes(p.status)||typeof p.uid11!=='string'||packages.has(p.uid11))return false;
      if([p.endereco,p.destinatario,p.codigo,p.motivo].some(v=>v!=null&&(/[<>]/.test(String(v))||typeof v==='object')))return false;
      if(p.photos11!==undefined&&(!Array.isArray(p.photos11)||p.photos11.some(id=>typeof id!=='string')))return false;
      packages.add(p.uid11);return true;
    });
  });
}
function note(type,detail){const r=route();r.events=r.events||[];r.events.push({at:Date.now(),type,detail});if(r.events.length>5000)r.events.splice(0,r.events.length-5000);}
function save(){
  ensure();revision++;
  grupos.forEach(g=>g.pacotes.forEach(p=>{
    if(p.lastStatus11!==p.status){
      if(p.lastStatus11!==undefined){note('status',{package:p.uid11,from:p.lastStatus11,to:p.status,motivo:p.motivo||null});p.statusAt11=Date.now();if(p.status==='entregue')p.deliveredAt11=Date.now();}
      p.lastStatus11=p.status;
    }
  }));
  if(!grupos.some(g=>g.id===route().next&&pending(g)))route().next=null;
  const s=JSON.stringify(snapshot());
  let localOK=false;
  try{localStorage.setItem(KEY,s);localOK=true;}catch(e){}
  // Chaves antigas continuam disponíveis para a cópia V10.6.
  try{localStorage.setItem(CHAVE_STORAGE,JSON.stringify(grupos));localStorage.setItem(META_ROTA_STORAGE_KEY,JSON.stringify(metaRota));localStorage.setItem(MEMORY,JSON.stringify(memories));}catch(e){}
  saveQueue=saveQueue.then(()=>store('state','current',JSON.parse(s))).catch(()=>{
    if(!localOK&&!storageWarned){storageWarned=true;mostrarToast('Não foi possível salvar no aparelho. Exporte um backup antes de fechar.','alerta');}
  });
  if(!localOK&&!storageWarned){mostrarToast('Salvamento principal indisponível; tentando cópia local de segurança.','alerta');}
  updatePanel();
}
function restore(){
  let s;try{s=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){}
  if(validSnapshot(s)){grupos=s.grupos;metaRota=s.metaRota;memories=s.memories||memories;ensure();renderizarTudo();return true;}
  return false;
}
function invalidate(){metaRota.geometriaRota=null;metaRota.distanciaMetros=null;metaRota.duracaoSegundos=null;route().eta=null;}
function reorder(id,action){
  const g=encontrarGrupo(id);if(!g)return;
  if(action==='retry'){
    g.pacotes.forEach(p=>{if(p.status==='ocorrencia'){p.status='pendente';p.motivo=null;}});
    opts(g).deferred=false;
  }
  if(!pending(g)){mostrarToast('Esta parada não tem pacotes pendentes.','alerta');return;}
  if(action==='now'){route().next=id;opts(g).deferred=false;}
  if(action==='later'){opts(g).deferred=true;if(route().next===id)route().next=null;}
  const savedBlock=route().blocks?.find(b=>b.ids.includes(id));
  const ids=new Set(savedBlock?savedBlock.ids:[id]);
  const block=grupos.filter(x=>pending(x)&&ids.has(x.id));
  const active=grupos.filter(x=>pending(x)&&!ids.has(x.id));
  if(action==='now'){block.sort((a,b)=>Number(b.id===id)-Number(a.id===id));active.unshift(...block);}else active.push(...block);
  grupos=[...active,...grupos.filter(x=>!pending(x))];
  grupos.forEach((x,i)=>x.ordemOtimizada=i+1);
  metaRota.modo='auto_v9';invalidate();note(action,{stop:id});save();renderizarTudo();close();
  mostrarToast(action==='now'?'Próxima parada fixada; sua região será concluída em seguida. Recalcule o trajeto.':action==='later'?'Região deixada para o final para evitar idas e voltas. Recalcule o trajeto.':'Ocorrências voltaram para pendentes; entregues preservados.','sucesso');
}
// Avaliação por horários absolutos: não perde a data ao ultrapassar meia-noite.
function evaluate(order,matrix,stops,startAt){
  const midnight=new Date(startAt);midnight.setHours(0,0,0,0);
  let t=startAt/1000,prev=0,distance=0,travel=0,misses=0,late=0,soft=0,priority=0;
  const arrivals=[];
  for(const i of order){
    const g=stops[i-1],o=g.v11||{};
    const leg=matrix.duracoes[prev][i],km=matrix.distancias[prev][i];
    if(!Number.isFinite(leg)||!Number.isFinite(km))return {score:[Infinity],arrivals:[],duration:Infinity};
    t+=leg;travel+=leg;distance+=km;
    const lower=o.startMin;
    if(Number.isFinite(lower))t=Math.max(t,midnight.getTime()/1000+lower*60);
    const upper=g.janelaHardMin;
    const delay=Number.isFinite(upper)?Math.max(0,t-(midnight.getTime()/1000+upper*60)):0;
    if(delay>0){misses++;late+=delay;}
    const lo=g.janelaSoftInicioMin,hi=g.janelaSoftFimMin;
    if(Number.isFinite(lo))soft+=Math.max(0,midnight.getTime()/1000+lo*60-t);
    if(Number.isFinite(hi))soft+=Math.max(0,t-(midnight.getTime()/1000+hi*60));
    if(o.priority)priority+=t-startAt/1000;
    const service=tempoServicoGrupoSegundos(g);
    arrivals.push({id:g.id,at:t*1000,late:Math.ceil(delay/60),leg,service,lat:Number(g.lat),lng:Number(g.lng)});
    t+=service;prev=i;
  }
  const final=matrix.indiceDestinoFinalV9;
  if(Number.isInteger(final)&&order.length){
    const d=matrix.duracoes[prev][final],k=matrix.distancias[prev][final];
    if(!Number.isFinite(d)||!Number.isFinite(k))return {score:[Infinity],arrivals:[],duration:Infinity};
    t+=d;travel+=d;distance+=k;
  }
  return {score:[misses,late,priority,soft,t-startAt/1000,distance],arrivals,duration:t-startAt/1000,travel,distance,finish:t*1000,misses};
}
function better(a,b){for(let i=0;i<Math.max(a.score.length,b.score.length);i++){const d=(a.score[i]||0)-(b.score[i]||0);if(Math.abs(d)>.01)return d<0;}return false;}
function enforce(order,stops,next){
  return order.filter(i=>stops[i-1].id===next).concat(order.filter(i=>stops[i-1].id!==next&&!opts(stops[i-1]).deferred),order.filter(i=>stops[i-1].id!==next&&opts(stops[i-1]).deferred));
}
async function constrained(indices,matrix,stops,seeds,next,startAt){
  return ScannerRegioes.solve(indices,matrix,stops,next,startAt,evaluate);
}
async function optimize(destination=null){
  if(busy)return;
  if(!navigator.onLine){mostrarToast('Sem conexão. A sequência e as marcações continuam disponíveis; recalcule quando voltar o sinal.','alerta');return;}
  ensure();const active=grupos.filter(g=>pending(g)&&paradaTemCoordenadaValidaV84(g));
  if(!active.length){mostrarToast('Não há paradas pendentes com coordenadas válidas.','alerta');return;}
  busy=true;const rev=revision,routeId=route().id;
  try{
    abrirOverlayOtimizacao('Calculando apenas as entregas pendentes...');
    const start=await obterPontoInicialOtimizacao();
    const end=pontoValido(destination)?destination:null;
    const matrix=await consultarMatrizGlobalOSRM([start,...active.map(pontoGrupo),...(end?[end]:[])]);
    matrix.indiceDestinoFinalV9=end?active.length+1:null;
    const indices=active.map((_,i)=>i+1);
    // Não passa pelo motor global: ele poderia intercalar regiões.
    const startAt=Math.max(Date.now(),route().pauseUntil||0);
    const chosen=await constrained(indices,matrix,active,[indices],route().next,startAt);
    if(!Number.isFinite(chosen.metrics.duration))throw new Error('Há endereços sem acesso pela malha viária.');
    const ordered=chosen.order.map(i=>active[i-1]);
    const geometry=await geometriaRotaPelasRuasV81(ordered,start,end);
    if(revision!==rev||route().id!==routeId)throw new Error('A rota mudou durante o cálculo. Recalcule novamente.');
    const v=route();v.blocks=chosen.blocks.map(b=>({label:b.label,explicit:b.explicit,ids:b.members.map(i=>active[i-1].id)}));
    for(const block of v.blocks)for(const id of block.ids)opts(active.find(g=>g.id===id)).blockLabel=block.label;
    v.eta={calculatedAt:Date.now(),startAt,arrivals:chosen.metrics.arrivals,finish:chosen.metrics.finish,tail:end?matrix.duracoes[chosen.order.at(-1)][matrix.indiceDestinoFinalV9]:0};
    grupos=[...ordered,...grupos.filter(g=>pending(g)&&!active.includes(g)),...grupos.filter(g=>!pending(g))];
    grupos.forEach((g,i)=>g.ordemOtimizada=i+1);
    metaRota={...metaRota,modo:'auto_v9',provedor:'OSRM_GLOBAL',criterio:'v11_1_scanner_regioes_contiguas',destinoFinal:end,inicioRota:start,geometriaRota:geometry,distanciaMetros:chosen.metrics.distance,duracaoSegundos:chosen.metrics.duration,atualizadoEm:Date.now(),v11:v};
    note('optimized',{stops:active.length,late:chosen.metrics.misses});save();renderizarTudo();
    mostrarToast(chosen.metrics.misses?`${chosen.metrics.misses} parada(s) com atraso previsto. Revise horários e escolhas manuais.`:geometry?'Rota organizada por regiões completas; pacotes preservados.':'Sequência atualizada. O desenho do trajeto está indisponível.','neutro');
  }catch(e){mostrarToast('Não alterei a sequência. '+(e.message||'Falha ao calcular a rota.'),'alerta');}
  finally{busy=false;fecharOverlayOtimizacao();updatePanel();}
}
function etaNow(){
  const cached=route().eta;if(!cached)return null;
  const remaining=grupos.filter(pending);
  if(!remaining.length)return {arrivals:[],finish:Date.now(),approx:false};
  const byId=new Map(cached.arrivals.map(a=>[a.id,a]));
  if(remaining.some(g=>!byId.has(g.id)))return null;
  const firstIndex=cached.arrivals.findIndex(a=>a.id===remaining[0].id);
  let anchor=cached.startAt;
  // Mantém o horário calculado enquanto o motorista está no mesmo trecho.
  // Ao concluir paradas, usa o último horário real como nova partida.
  for(const a of cached.arrivals.slice(0,firstIndex)){
    const done=grupos.find(g=>g.id===a.id);
    if(done&&!pending(done))anchor=Math.max(anchor,...done.pacotes.map(p=>p.statusAt11||a.at+a.service*1000));
  }
  let t=Math.max(anchor,route().pauseUntil||0),arrivals=[];
  const day=new Date(cached.startAt);day.setHours(0,0,0,0);
  for(const g of remaining){
    const a=byId.get(g.id);t+=a.leg*1000;
    if(Number.isFinite(opts(g).startMin))t=Math.max(t,day.getTime()+opts(g).startMin*60000);
    arrivals.push({id:g.id,at:t,late:Number.isFinite(g.janelaHardMin)&&t>day.getTime()+g.janelaHardMin*60000});
    t+=tempoServicoGrupoSegundos(g)*1000;
  }
  return {arrivals,finish:t+(cached.tail||0)*1000,approx:true,calculatedAt:cached.calculatedAt};
}
function btn(label,action,id='',extra=''){return `<button type="button" class="ce11-btn" data-ce11="${action}" data-id="${esc(encodeURIComponent(id))}" ${extra}>${label}</button>`;}
function entry(g){return `<div class="ce11-entry">${btn('Detalhes e ações','open',g.id)}${opts(g).blockLabel?`<small>Bloco: ${esc(opts(g).blockLabel)}</small>`:''}${opts(g).notes?`<small>${esc(opts(g).notes)}</small>`:''}${route().next===g.id?'<small>Próxima parada fixada</small>':''}${opts(g).deferred?'<small>Deixada para o final</small>':''}</div>`;}
function cleanupDialog(){
  stopCamera();
  for(const url of photoUrls){try{URL.revokeObjectURL(url);}catch(e){}}
  photoUrls=[];selected=null;
}
function close(){
  const d=document.getElementById('ce11-dialog');
  // Fechar a interface não depende do driver da câmera nem de arquivos locais.
  try{if(d?.open)d.close();}finally{if(d?.open)d.removeAttribute('open');cleanupDialog();}
}
function modal(title,html){
  stopCamera();photoUrls.forEach(URL.revokeObjectURL);photoUrls=[];
  const d=document.getElementById('ce11-dialog');d.innerHTML=`<header><h2>${esc(title)}</h2><form method="dialog" class="ce11-close-form"><button type="submit" class="ce11-btn" aria-label="Fechar janela">Fechar</button></form></header><div class="ce11-body">${html}</div>`;
  if(!d.open)d.showModal();
}
function open(id){
  const g=encontrarGrupo(id);if(!g)return;ensure();selected=id;
  const o=opts(g),m=memories[memoryKey(g)],eta=etaNow()?.arrivals.find(a=>a.id===id);
  modal('Detalhes da entrega',`<p>${esc(g.endereco)}</p>${eta?`<p>Chegada estimada: <b>${clock(eta.at)}</b>${eta.late?' · atraso previsto':''}</p>`:''}
    <div class="ce11-actions">${pending(g)?btn('Entregar agora','now',id)+btn('Deixar para depois','later',id):''}${g.pacotes.some(p=>p.status==='ocorrencia')?btn('Tentar novamente','retry',id):''}${btn('Ler etiqueta desta parada','scan',id)}</div>
    <form id="ce11-stop-form"><label>Bairro / região da rota<input id="ce11-region" maxlength="100" value="${esc(o.region||g.bairro||'')}" placeholder="Automático por proximidade, se vazio"></label><label>Observações de acesso<textarea id="ce11-notes" maxlength="1000">${esc(o.notes||'')}</textarea></label>
    <div class="ce11-grid"><label>Recebe a partir de<input id="ce11-start" type="time" value="${timeInput(o.startMin)}"></label><label>Recebe até<input id="ce11-end" type="time" value="${timeInput(g.janelaHardMin)}"></label>
    <label>Preferência a partir de<input id="ce11-soft-start" type="time" value="${timeInput(g.janelaSoftInicioMin)}"></label><label>Preferência até<input id="ce11-soft-end" type="time" value="${timeInput(g.janelaSoftFimMin)}"></label>
    <label>Atendimento (minutos)<input id="ce11-service" type="number" min="0.5" max="180" step="0.5" value="${tempoServicoGrupoSegundos(g)/60}"></label>
    <label>Prioridade<select id="ce11-priority"><option value="0">Normal</option><option value="1" ${o.priority?'selected':''}>Urgente</option></select></label></div>
    <p class="ce11-help">Concluímos cada bairro/região antes do próximo. Sem bairro informado, os blocos são estimados pela proximidade e pelas ruas. Horários pertencem ao mesmo dia; conflitos são avisados.</p>
    <button type="submit" class="ce11-btn ce11-primary">Salvar detalhes</button></form>
    <details><summary>Localização e memória do endereço</summary><p>Confirme a entrada correta antes de guardar para outras rotas.</p>
    <div class="ce11-grid"><label>Latitude<input id="ce11-lat" type="number" step="any" value="${esc(g.lat)}"></label><label>Longitude<input id="ce11-lng" type="number" step="any" value="${esc(g.lng)}"></label></div>
    ${btn('Usar minha posição como entrada','gps',id)}${btn('Confirmar pin e guardar acesso','remember',id)}
    ${m?`<p>Acesso guardado em ${new Date(m.at).toLocaleDateString('pt-BR')}.</p>${btn('Aplicar acesso guardado','apply-memory',id)}${btn('Esquecer acesso guardado','forget-memory',id)}`:''}</details>
    <h3>Pacotes, contato e comprovantes</h3>${g.pacotes.map((p,i)=>`<section class="ce11-package"><b>${esc(p.codigo)}</b><p>${esc(p.destinatario||'')} · ${esc(p.status)}</p>
      <label>Telefone<input id="ce11-phone-${i}" type="tel" value="${esc(p.telefone||'')}" placeholder="DDD + número"></label>
      <div class="ce11-actions">${btn('Salvar telefone','phone',id,`data-index="${i}"`)}${btn('Ligar','call',id,`data-index="${i}"`)}${btn('WhatsApp','whatsapp',id,`data-index="${i}"`)}</div>
      <label>Observação do comprovante<textarea id="ce11-proof-${i}" maxlength="1000">${esc(p.proofNote11||'')}</textarea></label>
      ${btn('Salvar observação','proof-note',id,`data-index="${i}"`)}
      <label class="ce11-upload">Adicionar foto (opcional)<input type="file" accept="image/*" capture="environment" data-photo-index="${i}"></label>
      <div id="ce11-photos-${i}"></div></section>`).join('')}
    <p class="ce11-help">Fotos e observações ficam neste aparelho. O backup inclui os comprovantes. Nenhuma mensagem é enviada automaticamente.</p>`);
  document.getElementById('ce11-stop-form').onsubmit=e=>{e.preventDefault();saveDetails(id);};
  loadPhotos(g);
}
function saveDetails(id){
  const g=encontrarGrupo(id);if(!g)return;
  const start=parseTime(document.getElementById('ce11-start').value),end=parseTime(document.getElementById('ce11-end').value);
  const lo=parseTime(document.getElementById('ce11-soft-start').value),hi=parseTime(document.getElementById('ce11-soft-end').value);
  const service=Number(document.getElementById('ce11-service').value);
  if((start!==null&&end!==null&&end<start)||(lo!==null&&hi!==null&&hi<lo)||service<.5||service>180||!Number.isFinite(service)){mostrarToast('Revise os horários e o tempo de atendimento.','alerta');return;}
  Object.assign(opts(g),{region:document.getElementById('ce11-region').value.trim(),startMin:start,notes:document.getElementById('ce11-notes').value.trim(),priority:document.getElementById('ce11-priority').value==='1'});
  g.janelaHardMin=end;g.janelaSoftInicioMin=lo;g.janelaSoftFimMin=hi;g.tempoServicoSegundos=service*60;
  route().eta=null;note('details',{stop:id});save();renderizarTudo();mostrarToast('Detalhes salvos. Recalcule para aplicar horários à sequência.','sucesso');
}
function remember(id){
  const g=encontrarGrupo(id),la=document.getElementById('ce11-lat').value,ln=document.getElementById('ce11-lng').value;
  if(!g||!la.trim()||!ln.trim()||!coordenadaValida(Number(la),Number(ln))){mostrarToast('Informe uma coordenada válida no Brasil.','alerta');return;}
  if(!g.cidade&&!g.cep){mostrarToast('A memória precisa de cidade ou CEP na planilha para não confundir endereços.','alerta');return;}
  g.lat=Number(la);g.lng=Number(ln);opts(g).notes=document.getElementById('ce11-notes').value.trim();
  memories[memoryKey(g)]={lat:g.lat,lng:g.lng,notes:opts(g).notes,at:Date.now()};
  invalidate();note('confirmed-pin',{stop:id});save();renderizarTudo();open(id);mostrarToast('Entrada e acesso guardados para este endereço.','sucesso');
}
function applyMemory(id){const g=encontrarGrupo(id),m=g&&memories[memoryKey(g)];if(!m)return;g.lat=m.lat;g.lng=m.lng;opts(g).notes=m.notes;invalidate();save();renderizarTudo();open(id);}
async function useGPS(){
  if(!navigator.geolocation){mostrarToast('GPS indisponível.','alerta');return;}
  const id=selected;
  navigator.geolocation.getCurrentPosition(p=>{
    if(id!==selected)return;
    document.getElementById('ce11-lat').value=p.coords.latitude;document.getElementById('ce11-lng').value=p.coords.longitude;
    mostrarToast(`Posição preenchida (precisão aproximada: ${Math.round(p.coords.accuracy)} m). Confira e confirme o pin.`,'neutro');
  },()=>mostrarToast('Não foi possível acessar o GPS.','alerta'),{enableHighAccuracy:true,timeout:15000});
}
function phoneNumber(s){let d=String(s).replace(/\D/g,'');if(d.length===10||d.length===11)d='55'+d;return /^55\d{10,11}$/.test(d)?d:null;}
function contact(id,index,action){
  const g=encontrarGrupo(id),p=g?.pacotes[index];if(!p)return;
  const raw=document.getElementById('ce11-phone-'+index).value,n=phoneNumber(raw);
  if(!n){mostrarToast('Informe telefone brasileiro com DDD.','alerta');return;}
  p.telefone=n;save();
  if(action==='phone'){mostrarToast('Telefone salvo.','sucesso');return;}
  const url=action==='call'?'tel:+'+n:'https://wa.me/'+n+'?text='+encodeURIComponent('Olá! Sou o entregador do seu pedido. Podemos confirmar o recebimento?');
  window.open(url,'_blank','noopener,noreferrer');
}
async function loadPhotos(g){
  for(let i=0;i<g.pacotes.length;i++)for(const id of g.pacotes[i].photos11||[]){
    try{const photo=await store('photos',id);if(selected!==g.id)return;
      if(photo){const el=document.getElementById('ce11-photos-'+i);if(!el)continue;const img=document.createElement('img');img.alt='Comprovante do pacote '+g.pacotes[i].codigo;img.src=URL.createObjectURL(photo.blob);photoUrls.push(img.src);img.className='ce11-photo';el.append(img);}
    }catch(e){mostrarToast('Não consegui abrir os comprovantes locais.','alerta');return;}
  }
}
async function addPhoto(file,index){
  const id=selected,g=encontrarGrupo(id),p=g?.pacotes[index];if(!file||!p)return;
  if(file.size>20*1024*1024||!file.type.startsWith('image/')){mostrarToast('Use uma imagem de até 20 MB.','alerta');return;}
  try{
    const bitmap=await createImageBitmap(file),scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
    const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',.82));if(!blob)throw new Error();
    const photoId=uid();await store('photos',photoId,{blob,package:p.uid11,at:Date.now()});
    if(!grupos.some(x=>x.pacotes.some(q=>q.uid11===p.uid11)))throw new Error('A rota mudou.');
    p.photos11=p.photos11||[];p.photos11.push(photoId);note('photo',{package:p.uid11});save();
    if(selected===id)open(id);mostrarToast('Foto salva neste aparelho.','sucesso');
  }catch(e){mostrarToast('Não consegui salvar a foto. Verifique o espaço e tente novamente.','alerta');}
}
function code(s){return String(s||'').trim().toUpperCase();}
function findCode(value){const c=code(value);return grupos.flatMap(g=>g.pacotes.map((p,i)=>({g,p,i}))).filter(x=>code(x.p.codigo)===c&&c!==''&&c!=='-');}
function scan(expected=null){
  selected=null;
  modal('Ler etiqueta',`<p>${expected?'Confira se o pacote pertence à parada selecionada.':'Leia ou digite o código para localizar uma entrega.'}</p><video id="ce11-video" playsinline muted></video>
    ${btn('Ativar câmera','camera')}<form id="ce11-code-form"><label>Código da etiqueta<input id="ce11-code" autocomplete="off" required></label><button class="ce11-btn" type="submit">Conferir código</button></form><div id="ce11-scan-result" aria-live="polite"></div>`);
  document.getElementById('ce11-dialog').dataset.expected=expected||'';
  document.getElementById('ce11-code-form').onsubmit=e=>{e.preventDefault();scanResult(document.getElementById('ce11-code').value,expected);};
}
function scanResult(value,expected){
  stopCamera();const found=findCode(value),el=document.getElementById('ce11-scan-result');if(!el)return;
  if(!found.length){el.textContent='Código não encontrado nesta rota. Confira a etiqueta ou digite o código.';return;}
  el.innerHTML=(found.length>1?'<p>Este código aparece mais de uma vez. Confira os endereços.</p>':'')+found.map(x=>`<div class="ce11-package"><b>${expected?(x.g.id===expected?'Pacote desta parada':'Atenção: pacote de outra parada'):'Pacote encontrado'}</b><p>${esc(x.p.codigo)} · ${esc(x.g.endereco)}</p><p>${esc(x.p.status)}</p>${btn('Abrir entrega','open',x.g.id)}</div>`).join('');
}
function stopCamera(){
  scannerToken++;
  const controls=scannerControls;scannerControls=null;
  const v=document.getElementById('ce11-video'),stream=v?.srcObject;
  try{const result=controls?.stop();if(result?.catch)result.catch(()=>{});}catch(e){console.warn('Falha ao encerrar o leitor:',e);}
  try{for(const track of stream?.getTracks()||[]){try{track.stop();}catch(e){}}}catch(e){}
  if(v){try{if(stream)v.pause();v.srcObject=null;}catch(e){}}
}
async function camera(){
  stopCamera();const token=scannerToken,video=document.getElementById('ce11-video'),expected=document.getElementById('ce11-dialog').dataset.expected||null;
  if(!navigator.mediaDevices?.getUserMedia||!window.ZXingBrowser){mostrarToast('Câmera indisponível neste navegador. Use a digitação do código.','alerta');return;}
  try{
    const reader=new ZXingBrowser.BrowserMultiFormatReader();
    const controls=await reader.decodeFromConstraints({audio:false,video:{facingMode:{ideal:'environment'}}},video,(result,error,controls)=>{
      if(token!==scannerToken){controls.stop();return;}
      if(result){controls.stop();scanResult(result.getText(),expected);}
    });
    if(token!==scannerToken)controls.stop();else scannerControls=controls;
  }catch(e){if(token===scannerToken)mostrarToast('Não consegui abrir a câmera. Confira a permissão ou digite o código.','alerta');}
}
function pause(){modal('Pausa da rota',`<p>A pausa entra na previsão de término.</p><form id="ce11-pause-form"><label>Duração em minutos<input type="number" id="ce11-pause-min" value="15" min="1" max="240" required></label><button class="ce11-btn" type="submit">Iniciar pausa</button></form>${btn('Encerrar pausa agora','resume')}`);document.getElementById('ce11-pause-form').onsubmit=e=>{e.preventDefault();route().pauseUntil=Date.now()+Number(document.getElementById('ce11-pause-min').value)*60000;note('pause',{});save();close();};}
function download(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);}
const blobData=b=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(b);});
async function backup(){
  try{const s=JSON.parse(JSON.stringify(snapshot()));s.photos={};
    for(const g of s.grupos)for(const p of g.pacotes)for(const id of p.photos11||[]){const ph=await store('photos',id);if(!ph)throw new Error('Um comprovante não foi encontrado.');s.photos[id]={...ph,blob:undefined,data:await blobData(ph.blob)};}
    download('copiloto-backup-'+new Date().toISOString().slice(0,10)+'.json',new Blob([JSON.stringify(s)],{type:'application/json'}));
  }catch(e){mostrarToast('Backup não concluído: '+e.message,'alerta');}
}
async function importBackup(file){
  if(!file)return;
  try{
    if(file.size>100*1024*1024)throw new Error('Arquivo maior que 100 MB.');
    const s=JSON.parse(await file.text());if(!validSnapshot(s))throw new Error('Backup inválido.');
    if(!confirm('Restaurar este backup substitui a rota aberta. Exporte a rota atual antes, se quiser guardá-la. Continuar?'))return;
    for(const g of s.grupos)for(const p of g.pacotes)for(const id of p.photos11||[]){const ph=s.photos?.[id];if(!ph||!/^data:image\/(jpeg|png|webp);base64,/.test(ph.data))throw new Error('Comprovante ausente ou inválido.');}
    for(const [id,ph] of Object.entries(s.photos||{})){
      if(!/^data:image\/(jpeg|png|webp);base64,/.test(ph.data))throw new Error('Imagem inválida.');
      const [head,body]=ph.data.split(','),bytes=Uint8Array.from(atob(body),c=>c.charCodeAt(0));await store('photos',id,{blob:new Blob([bytes],{type:head.slice(5,head.indexOf(';'))}),package:ph.package,at:ph.at});
    }
    grupos=s.grupos;metaRota=s.metaRota;memories=s.memories||{};save();renderizarTudo();close();mostrarToast('Backup restaurado.','sucesso');
  }catch(e){mostrarToast('Não foi possível restaurar: '+e.message,'alerta');}
}
function backupMenu(){modal('Backup e funcionamento sem sinal',`<p>A lista, a organização, as ocorrências e os comprovantes são salvos neste aparelho. Exporte um backup para guardar outra cópia.</p>${btn('Exportar rota e comprovantes','export')}<label class="ce11-upload">Restaurar backup<input type="file" id="ce11-restore" accept=".json,application/json"></label><p>Sem sinal, você pode consultar e marcar entregas. Novos mapas, busca de endereços, recálculo e WhatsApp precisam de conexão.</p><p id="ce11-offline-info">${esc(offlineStatus)}</p>`);}
let offlineStatus='O HTML local abre sem rede. Para reabrir o site sem sinal, publique também o arquivo sw.js e abra o site uma vez com conexão.';
function updatePanel(){
  const el=document.getElementById('ce11-summary');if(!el)return;
  const estimate=etaNow(),next=estimate?.arrivals[0],paused=route().pauseUntil>Date.now();
  el.textContent=(navigator.onLine?'Salvo neste aparelho':'Sem conexão · continue marcando entregas')+(paused?' · pausa até '+clock(route().pauseUntil):'')+(estimate?next?' · próxima ~'+clock(next.at)+' · término ~'+clock(estimate.finish):' · sem entregas pendentes':' · recalcule para estimar os horários');
  const help=document.getElementById('ce11-eta-help');if(help)help.textContent=estimate?.calculatedAt?'Estimativa sem trânsito ao vivo, baseada no cálculo de '+clock(estimate.calculatedAt)+'. Recalcule após desvios.':'';
}
function attach(){
  const oldBuild=construirConteudoLocal;construirConteudoLocal=g=>oldBuild(g)+entry(g);
  const oldInfo=conteudoInfoHtml;conteudoInfoHtml=g=>oldInfo(g)+entry(g);
  irParaOcorrenciaHome=id=>open(id);
  const oldOccurrences=renderizarOcorrencias;renderizarOcorrencias=()=>{oldOccurrences();for(const g of grupos){const card=document.getElementById('grupo_oc_'+g.id);if(card)card.insertAdjacentHTML('beforeend',entry(g));}};
  const oldRender=renderizarTudo;renderizarTudo=()=>{oldRender();updatePanel();};
  salvarStorage=save;
  const oldLoad=carregarStorage;carregarStorage=()=>{if(!restore()){oldLoad();ensure();}};
  otimizarRotaAutomaticamenteV9=optimize;
  const oldImport=processarEntregas;
  processarEntregas=async rows=>{
    if(busy){mostrarToast('Aguarde o cálculo atual.','alerta');return;}
    if(grupos.length&&!confirm('Importar uma planilha inicia uma nova rota. Exporte um backup da rota atual se precisar guardá-la. Continuar?'))return;
    if(!Array.isArray(rows)||!rows.length||rows.some(r=>!r['Destination Address']&&!r.Address)){mostrarToast('Planilha vazia ou sem a coluna de endereço esperada. A rota atual foi mantida.','alerta');return;}
    const before=JSON.parse(JSON.stringify(snapshot()));
    try{await store('state','before-import',before);}catch(e){}
    try{await oldImport(rows);ensure();save();const matches=grupos.filter(g=>memories[memoryKey(g)]).length;if(matches)mostrarToast(`${matches} endereço(s) com acesso guardado. Aplique em Detalhes e ações.`,'neutro');}
    catch(e){grupos=before.grupos;metaRota=before.metaRota;save();renderizarTudo();fecharOverlayOtimizacao();mostrarToast('Falha ao importar. Rota anterior restaurada.','alerta');}
  };
  // Snapshot completo antes de substituir a rota; recuperação disponível no backup.
  document.addEventListener('click',async e=>{
    const b=e.target.closest('[data-ce11]');if(!b)return;
    const action=b.dataset.ce11,id=decodeURIComponent(b.dataset.id||''),index=Number(b.dataset.index);
    try{
      if(action==='close')close();else if(action==='open')open(id);
      else if(['now','later','retry'].includes(action))reorder(id,action);
      else if(action==='optimize')await optimize(carregarConfiguracaoV9().destinoFinal);
      else if(action==='scan')scan(id||null);else if(action==='camera')await camera();
      else if(action==='remember')remember(id);else if(action==='apply-memory')applyMemory(id);else if(action==='gps')useGPS();
      else if(action==='forget-memory'){delete memories[memoryKey(encontrarGrupo(id))];save();open(id);}
      else if(['phone','call','whatsapp'].includes(action))contact(id,index,action);
      else if(action==='proof-note'){const p=encontrarGrupo(id).pacotes[index];p.proofNote11=document.getElementById('ce11-proof-'+index).value.trim();p.proofAt11=Date.now();save();mostrarToast('Observação salva.','sucesso');}
      else if(action==='pause')pause();else if(action==='resume'){route().pauseUntil=0;save();close();}
      else if(action==='backup')backupMenu();else if(action==='export')await backup();
    }catch(err){mostrarToast('Não consegui concluir esta ação. Tente novamente.','alerta');console.error(err);}
  });
  document.addEventListener('change',e=>{if(e.target.matches('[data-photo-index]'))addPhoto(e.target.files[0],Number(e.target.dataset.photoIndex));if(e.target.id==='ce11-restore')importBackup(e.target.files[0]);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera();});
  window.addEventListener('pagehide',()=>{stopCamera();save();});
  window.addEventListener('online',updatePanel);window.addEventListener('offline',updatePanel);
  const panel=document.createElement('section');panel.className='ce11-panel';panel.innerHTML=`<b>Durante a rota</b><p id="ce11-summary"></p><small id="ce11-eta-help"></small><div class="ce11-actions">${btn('Recalcular pendentes','optimize')}${btn('Ler etiqueta','scan')}${btn('Pausa','pause')}${btn('Backup / sem sinal','backup')}</div>`;
  document.getElementById('cardPrincipalLista').append(panel);
  const dialog=document.createElement('dialog');dialog.id='ce11-dialog';
  dialog.addEventListener('close',cleanupDialog);
  dialog.addEventListener('cancel',()=>{cleanupDialog();});
  // Caminho direto para o botão e fallback; method=dialog ainda funciona sem JS.
  dialog.addEventListener('submit',e=>{if(e.target.matches('.ce11-close-form')){e.preventDefault();close();}});
  document.body.append(dialog);
  setInterval(updatePanel,30000);
}
async function init(){
  ensure();updatePanel();
  // Recuperação do espelho apenas quando não houve ação nem rota carregada.
  if(!grupos.length){const rev=revision;try{const s=await store('state','current');if(rev===revision&&!grupos.length&&validSnapshot(s)){grupos=s.grupos;metaRota=s.metaRota;memories=s.memories||{};renderizarTudo();}}catch(e){}}
  if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))try{
    await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;offlineStatus='Aplicativo preparado para reabrir sem sinal neste navegador. Mapas e novos cálculos ainda precisam de conexão.';
  }catch(e){offlineStatus='O salvamento local está disponível. Para reabrir o site sem sinal, publique sw.js ao lado do HTML.';}
}
return {attach,init,open,close,save,restore,entry,optimize,evaluate,constrained,enforce,etaNow,findCode,phoneNumber,validSnapshot,memoryKey,reorder,backup,importBackup};
})();
L.Icon.Default.mergeOptions({iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAFgUlEQVR4Aa1XA5BjWRTN2oW17d3YaZtr2962HUzbDNpjszW24mRt28p47v7zq/bXZtrp/lWnXr337j3nPCe85NcypgSFdugCpW5YoDAMRaIMqRi6aKq5E3YqDQO3qAwjVWrD8Ncq/RBpykd8oZUb/kaJutow8r1aP9II0WmLKLIsJyv1w/kqw9Ch2MYdB++12Onxee/QMwvf4/Dk/Lfp/i4nxTXtOoQ4pW5Aj7wpici1A9erdAN2OH64x8OSP9j3Ft3b7aWkTg/Fm91siTra0f9on5sQr9INejH6CUUUpavjFNq1B+Oadhxmnfa8RfEmN8VNAsQhPqF55xHkMzz3jSmChWU6f7/XZKNH+9+hBLOHYozuKQPxyMPUKkrX/K0uWnfFaJGS1QPRtZsOPtr3NsW0uyh6NNCOkU3Yz+bXbT3I8G3xE5EXLXtCXbbqwCO9zPQYPRTZ5vIDXD7U+w7rFDEoUUf7ibHIR4y6bLVPXrz8JVZEql13trxwue/uDivd3fkWRbS6/IA2bID4uk0UpF1N8qLlbBlXs4Ee7HLTfV1j54APvODnSfOWBqtKVvjgLKzF5YdEk5ewRkGlK0i33Eofffc7HT56jD7/6U+qH3Cx7SBLNntH5YIPvODnyfIXZYRVDPqgHtLs5ABHD3YzLuespb7t79FY34DjMwrVrcTuwlT55YMPvOBnRrJ4VXTdNnYug5ucHLBjEpt30701A3Ts+HEa73u6dT3FNWwflY86eMHPk+Yu+i6pzUpRrW7SNDg5JHR4KapmM5Wv2E8Tfcb1HoqqHMHU+uWDD7zg54mz5/2BSnizi9T1Dg4QQXLToGNCkb6tb1NU+QAlGr1++eADrzhn/u8Q2YZhQVlZ5+CAOtqfbhmaUCS1ezNFVm2imDbPmPng5wmz+gwh+oHDce0eUtQ6OGDIyR0uUhUsoO3vfDmmgOezH0mZN59x7MBi++WDL1g/eEiU3avlidO671bkLfwbw5XV2P8Pzo0ydy4t2/0eu33xYSOMOD8hTf4CrBtGMSoXfPLchX+J0ruSePw3LZeK0juPJbYzrhkH0io7B3k164hiGvawhOKMLkrQLyVpZg8rHFW7E2uHOL888IBPlNZ1FPzstSJM694fWr6RwpvcJK60+0HCILTBzZLFNdtAzJaohze60T8qBzyh5ZuOg5e7uwQppofEmf2++DYvmySqGBuKaicF1blQjhuHdvCIMvp8whTTfZzI7RldpwtSzL+F1+wkdZ2TBOW2gIF88PBTzD/gpeREAMEbxnJcaJHNHrpzji0gQCS6hdkEeYt9DF/2qPcEC8RM28Hwmr3sdNyht00byAut2k3gufWNtgtOEOFGUwcXWNDbdNbpgBGxEvKkOQsxivJx33iow0Vw5S6SVTrpVq11ysA2Rp7gTfPfktc6zhtXBBC+adRLshf6sG2RfHPZ5EAc4sVZ83yCN00Fk/4kggu40ZTvIEm5g24qtU4KjBrx/BTTH8ifVASAG7gKrnWxJDcU7x8X6Ecczhm3o6YicvsLXWfh3Ch1W0k8x0nXF+0fFxgt4phz8QvypiwCCFKMqXCnqXExjq10beH+UUA7+nG6mdG/Pu0f3LgFcGrl2s0kNNjpmoJ9o4B29CMO8dMT4Q5ox8uitF6fqsrJOr8qnwNbRzv6hSnG5wP+64C7h9lp30hKNtKdWjtdkbuPA19nJ7Tz3zR/ibgARbhb4AlhavcBebmTHcFl2fvYEnW0ox9xMxKBS8btJ+KiEbq9zA4RthQXDhPa0T9TEe69gWupwc6uBUphquXgf+/FrIjweHQS4/pduMe5ERUMHUd9xv8ZR98CxkS4F2n3EUrUZ10EYNw7BWm9x1GiPssi3GgiGRDKWRYZfXlON+dfNbM+GgIwYdwAAAAASUVORK5CYII=",iconRetinaUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAABSCAMAAAAhFXfZAAAC91BMVEVMaXEzeak2f7I4g7g3g7cua5gzeKg8hJo3grY4g7c3grU0gLI2frE0daAubJc2gbQwd6QzeKk2gLMtd5sxdKIua5g1frA2f7IydaM0e6w2fq41fK01eqo3grgubJgta5cxdKI1f7AydaQydaMxc6EubJgvbJkwcZ4ubZkwcJwubZgubJcydqUydKIxapgubJctbJcubZcubJcvbJYubJcvbZkubJctbJctbZcubJg2f7AubJcrbZcubJcubJcua5g3grY0fq8ubJcubJdEkdEwhsw6i88vhswuhcsuhMtBjMgthMsrg8srgss6is8qgcs8i9A9iMYtg8spgcoogMo7hcMngMonf8olfso4gr8kfck5iM8jfMk4iM8he8k1fro7itAgesk2hs8eecgzfLcofssdeMg0hc4cd8g2hcsxeLQbdsgZdcgxeLImfcszhM0vda4xgckzhM4xg84wf8Yxgs4udKsvfcQucqhUndROmdM1fK0wcZ8vb5w0eqpQm9MzeKhXoNVcpdYydKNWn9VZotVKltJFjsIwcJ1Rms9OlslLmtH///8+kc9epdYzd6dbo9VHkMM2f7FHmNBClM8ydqVcpNY9hro3gLM9hLczealQmcw3fa46f7A8gLMxc6I3eagyc6FIldJMl9JSnNRSntNNl9JPnNJFi75UnM9ZodVKksg8kM45jc09e6ZHltFBk883gbRBh7pDk9EwcaBzn784g7dKkcY2i81Om9M7j85Llc81is09g7Q4grY/j9A0eqxKmdFFltBEjcXf6fFImdBCiLxJl9FGlNFBi78yiMxVndEvbpo6js74+vx+psPP3+o/ks5HkcpGmNCjwdZCkNDM3ehYoNJEls+lxNkxh8xHks0+jdC1zd5Lg6r+/v/H2ufz9/o3jM3t8/edvdM/k89Th61OiLBSjbZklbaTt9BfptdjmL1AicBHj8hGk9FAgK1dkLNTjLRekrdClc/k7fM0icy0y9tgp9c4jc2NtM9Dlc8zicxeXZn3AAAAQ3RSTlMAHDdTb4yPA+LtnEQmC4L2EmHqB7XA0d0sr478x4/Yd5i1zOfyPkf1sLVq4Nh3FvjxopQ2/STNuFzUwFIwxKaejILpIBEV9wAABhVJREFUeF6s1NdyFEcYBeBeoQIhRAkLlRDGrhIgY3BJL8CVeKzuyXFzzjkn5ZxzzuScg3PO8cKzu70JkO0LfxdTU//pM9vTu7Xgf6KqOVTb9X7toRrVEfBf1HTVjZccrT/2by1VV928Yty9ZbVuucdz90frG8DBjl9pVApbOstvmMuvVgaNXSfAAd6pGxpy6yxf5ph43pS/4f3uoaGm2rdu72S9xzOvMymkZFq/ptDrk90mhW7e4zl7HLzhxGWPR20xmSxJ/VqldG5m9XhaVOA1DadsNh3Pu5L2N6QtPO/32JpqQBVVk20oy/Pi2s23WEvyfHbe1thadVQttvm7Llf65gGmXK67XtupyoM7HQhmXdLS8oGWJNeOJ3C5fG5XCEJnkez3/oFdsvgJ4l2ANZwhrJKk/7OSXa+3Vw2WJMlKnGkobouYk6T0TyX30klOUnTD9HJ5qpckL3EW/w4XF3Xd0FGywXUrstrclVsqz5Pd/sXFYyDnPdrLcQODmGOK47IZb4CmibmMn+MYRzFZ5jg33ZL/EJrWcszHmANy3ARBK/IXtciJy8VsitPSdE3uuHxzougojcUdr8/32atnz/ev3f/K5wtpxUTpcaI45zusVDpYtZi+jg0oU9b3x74h7+n9ABvYEZeKaVq0sh0AtLKsFtqNBdeT0MrSzwwlq9+x6xAO4tgOtSzbCjrNQQiNvQUbUEubvzBUeGw26yDCsRHCoLkTHDa7IdOLIThs/gHvChszh2CimE8peRs47cxANI0lYNB5y1DljpOF0IhzBDPOZnDOqYYbeGKECbPzWnXludPphw5c2YBq5zlwXphIbO4VDCZ0gnPfUO1TwZoYwAs2ExPCedAu9DAjfQUjzITQb3jNj0KG2Sgt6BHaQUdYzWz+XmBktOHwanXjaSTcwwziBcuMOtwBmqPrTOxFQR/DRKKPqyur0aiW6cULYsx6tBm0jXpR/AUWR6HRq9WVW6MRhIq5jLyjbaCTDCijyYJNpCajdyobP/eTw0iexBAKkJ3gA5KcQb2zBXsIBckn+xVv8jkZSaEFHE+jFEleAEfayRU0MouNoBmB/L50Ai/HSLIHxcrpCvnhSQAuakKp2C/YbCylJjXRVy/z3+Kv/RrNcCo+WUzlVEhzKffnTQnxeN9fWF88fiNCUdSTsaufaChKWInHeysygfpIqagoakW+vV20J8uyl6TyNKEZWV4oRSPyCkWpgOLSbkCObT8o2r6tlG58HQquf6O0v50tB7JM7F4EORd2dx/K0w/KHsVkLPaoYrwgP/y7krr3SSMA4zj+OBgmjYkxcdIJQyQRKgg2viX9Hddi9UBb29LrKR7CVVEEEXWojUkXNyfTNDE14W9gbHJNuhjDettN3ZvbOvdOqCD3Jp/9l+/wJE+9PkYGjx/fqkys3S2rMozM/o2106rfMUINo6hVqz+eu/hd1c4xTg0TAfy5kV+4UG6+IthHTU9woWmxuKNbTfuCSfovBCxq7EtHqvYL4Sm6F8GVxsSXHMQ07TOi1DKtZxjWaaIyi4CXWjxPccUw8WVbMYY5wxC1mzEyXMJWkllpRloi+Kkoq69sxBTlElF6aAxYUbjXNlhlDZilDnM4U5SlN5biRsRHnbx3mbeWjEh4mEyiuJDl5XcWVmX5GvNkFgLWZM5qwsop4/AWfLhU1cR7k1VVvcYCWRkOI6Xy5gmnphCYIkvzuNYzHzosq2oNk2RtSs8khfUOfHIDgR6ysYBaMpl4uEgk2U/oJTs9AaTSwma7dT69geAE2ZpEjUsn2ieJNHeKfrI3EcAGJ2ZaNgVuC8EBctCLc57P5u5led6IOBkIYkuQMrmmjChs4VkfOerHqSBkPzZlhe06RslZ3zMjk2sscqKwY0RcjKK+LWbzd7KiHhkncs/siFJ+V5eXxD34B8nVuJEpGJNmxN2gH3vSvp7J70tF+D1Ej8qUJD1TkErAND2GZwTFg/LubvmgiBG3SOvdlsqFQrkEzJCL1rstlnVFROixZoDDSuXQFHESwVGlcuQcMb/b42NgjLowh5MTDFE3vNB5qStRIErdCQEh6pLPR92anSUb/wAIhldAaDMpGgAAAABJRU5ErkJggg==",shadowUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACkAAAApCAQAAAACach9AAACMUlEQVR4Ae3ShY7jQBAE0Aoz/f9/HTMzhg1zrdKUrJbdx+Kd2nD8VNudfsL/Th///dyQN2TH6f3y/BGpC379rV+S+qqetBOxImNQXL8JCAr2V4iMQXHGNJxeCfZXhSRBcQMfvkOWUdtfzlLgAENmZDcmo2TVmt8OSM2eXxBp3DjHSMFutqS7SbmemzBiR+xpKCNUIRkdkkYxhAkyGoBvyQFEJEefwSmmvBfJuJ6aKqKWnAkvGZOaZXTUgFqYULWNSHUckZuR1HIIimUExutRxwzOLROIG4vKmCKQt364mIlhSyzAf1m9lHZHJZrlAOMMztRRiKimp/rpdJDc9Awry5xTZCte7FHtuS8wJgeYGrex28xNTd086Dik7vUMscQOa8y4DoGtCCSkAKlNwpgNtphjrC6MIHUkR6YWxxs6Sc5xqn222mmCRFzIt8lEdKx+ikCtg91qS2WpwVfBelJCiQJwvzixfI9cxZQWgiSJelKnwBElKYtDOb2MFbhmUigbReQBV0Cg4+qMXSxXSyGUn4UbF8l+7qdSGnTC0XLCmahIgUHLhLOhpVCtw4CzYXvLQWQbJNmxoCsOKAxSgBJno75avolkRw8iIAFcsdc02e9iyCd8tHwmeSSoKTowIgvscSGZUOA7PuCN5b2BX9mQM7S0wYhMNU74zgsPBj3HU7wguAfnxxjFQGBE6pwN+GjME9zHY7zGp8wVxMShYX9NXvEWD3HbwJf4giO4CFIQxXScH1/TM+04kkBiAAAAAElFTkSuQmCC"});
L.Icon.Default.imagePath="";
CE11.attach();


aplicarSaudacao();
carregarPreferenciaSom();
atualizarResumoConfiguracaoV9();
iniciarGestosSheetListaMapa();

// ----------------------------------------------------------------------
// INICIALIZAÇÃO
// ----------------------------------------------------------------------

carregarStorage();
configurarControlesPorDispositivoV82();
carregarPreferenciasV10();
CE11.init();

// V7.1 é focada no celular: começa a pedir/acompanhar o GPS já ao abrir o
// Copiloto, para a otimização ter um ponto inicial pronto antes da importação.
iniciarRastreamentoLocalizacao();

