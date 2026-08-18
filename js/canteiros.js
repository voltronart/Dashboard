import { supabase } from './config.js'
import { montarSidebar } from './sidebar.js'

let canteiros = []
let cultivos = []
let editandoId = null

const el = (id) => document.getElementById(id)
const lista = () => el('lista')
const estadoVazio = () => el('estado-vazio')
const estadoCarregando = () => el('estado-carregando')
const contagem = () => el('contagem')
const alerta = () => el('alerta')

const STATUS_CORES = {
  'Livre': 'var(--status-livre)',
  'Em preparo': 'var(--status-preparo)',
  'Ocupado': 'var(--status-ocupado)',
  'Em descanso': 'var(--status-descanso)',
}

function mostrarErro(msg){
  alerta().textContent = msg
  alerta().style.display = 'block'
  setTimeout(() => alerta().style.display = 'none', 5000)
}

function escapeHtml(str){
  const d = document.createElement('div')
  d.textContent = str ?? ''
  return d.innerHTML
}

function formatarData(iso){
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

async function carregarCultivosParaSelect(){
  const { data, error } = await supabase.from('cultivos').select('id, nome').order('nome')
  if (error) return
  cultivos = data || []
  const select = el('f-cultivo')
  select.innerHTML = '<option value="">Nenhum / vazio</option>' +
    cultivos.map(c => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join('')
}

function nomeCultivo(id){
  const c = cultivos.find(x => x.id === id)
  return c ? c.nome : null
}

async function carregarCanteiros(){
  estadoCarregando().style.display = 'block'
  lista().innerHTML = ''
  estadoVazio().style.display = 'none'

  const { data, error } = await supabase
    .from('canteiros')
    .select('*')
    .order('numero', { ascending: true })

  estadoCarregando().style.display = 'none'

  if (error){
    mostrarErro('Não foi possível carregar os canteiros agora.')
    return
  }
  canteiros = data || []
  renderizar()
}

function renderizar(){
  const termo = el('busca').value.toLowerCase()
  const filtroStatus = el('filtro-status').value
  const filtrados = canteiros.filter(c => {
    const bateBusca = c.numero.toLowerCase().includes(termo)
    const bateStatus = !filtroStatus || c.status === filtroStatus
    return bateBusca && bateStatus
  })

  lista().innerHTML = ''

  if (filtrados.length === 0){
    estadoVazio().style.display = 'block'
    el('texto-vazio').textContent = canteiros.length === 0
      ? 'Nenhum canteiro cadastrado ainda. Comece adicionando o primeiro.'
      : 'Nenhum canteiro encontrado para esse filtro.'
  } else {
    estadoVazio().style.display = 'none'
    filtrados.forEach(c => lista().appendChild(criarItem(c)))
  }

  contagem().textContent = canteiros.length > 0
    ? `${canteiros.length} canteiro${canteiros.length !== 1 ? 's' : ''} cadastrado${canteiros.length !== 1 ? 's' : ''} · dados salvos no Supabase`
    : ''

  if (window.lucide) lucide.createIcons()
}

function criarItem(c){
  const div = document.createElement('div')
  div.className = 'item'

  const meta = []
  if (c.area) meta.push(`📐 ${c.area} m²`)
  const cultivo = nomeCultivo(c.cultivo_id)
  if (cultivo) meta.push(`🌱 ${cultivo}`)
  if (c.data_preparo) meta.push(`🗓️ Preparo: ${formatarData(c.data_preparo)}`)

  const cor = STATUS_CORES[c.status] || 'var(--muted)'

  div.innerHTML = `
    <div class="item-info">
      <div class="item-title">
        <h3>${escapeHtml(c.numero)}</h3>
        <span class="badge" style="background:${cor}">${escapeHtml(c.status || 'Livre')}</span>
      </div>
      <div class="item-meta">${meta.map(m => `<span>${m}</span>`).join('')}</div>
    </div>
    <div class="item-actions">
      <button class="icon-btn" data-editar="${c.id}" aria-label="Editar"><i data-lucide="pencil" size="16" color="#28381F"></i></button>
      <button class="icon-btn" data-excluir="${c.id}" aria-label="Excluir"><i data-lucide="trash-2" size="16" color="#A14A3A"></i></button>
    </div>
  `
  div.querySelector('[data-editar]').addEventListener('click', () => abrirEdicao(c))
  div.querySelector('[data-excluir]').addEventListener('click', () => excluir(c.id))
  return div
}

function abrirNovo(){
  editandoId = null
  el('modal-titulo').textContent = 'Novo canteiro'
  el('form-canteiro').reset()
  el('f-status').value = 'Livre'
  el('overlay').classList.add('open')
}

function abrirEdicao(c){
  editandoId = c.id
  el('modal-titulo').textContent = 'Editar canteiro'
  el('f-numero').value = c.numero || ''
  el('f-area').value = c.area || ''
  el('f-cultivo').value = c.cultivo_id || ''
  el('f-data-preparo').value = c.data_preparo || ''
  el('f-status').value = c.status || 'Livre'
  el('f-observacoes').value = c.observacoes || ''
  el('overlay').classList.add('open')
}

function fecharModal(){
  el('overlay').classList.remove('open')
  editandoId = null
}

async function salvar(e){
  e.preventDefault()
  const numero = el('f-numero').value.trim()
  if (!numero) return

  const btn = el('btn-salvar')
  btn.disabled = true
  btn.textContent = 'Salvando...'

  const registro = {
    numero,
    area: el('f-area').value ? parseFloat(el('f-area').value) : null,
    cultivo_id: el('f-cultivo').value || null,
    data_preparo: el('f-data-preparo').value || null,
    status: el('f-status').value,
    observacoes: el('f-observacoes').value.trim() || null,
  }

  let error
  if (editandoId){
    ({ error } = await supabase.from('canteiros').update(registro).eq('id', editandoId))
  } else {
    ({ error } = await supabase.from('canteiros').insert(registro))
  }

  btn.disabled = false
  btn.textContent = 'Salvar canteiro'

  if (error){
    mostrarErro('Não foi possível salvar este canteiro. Tente novamente.')
    return
  }

  fecharModal()
  await carregarCanteiros()
}

async function excluir(id){
  const { error } = await supabase.from('canteiros').delete().eq('id', id)
  if (error){
    mostrarErro('Não foi possível excluir este canteiro.')
    return
  }
  canteiros = canteiros.filter(c => c.id !== id)
  renderizar()
}

function iniciar(){
  montarSidebar('canteiros')

  el('btn-novo').addEventListener('click', abrirNovo)
  el('btn-fechar').addEventListener('click', fecharModal)
  el('btn-cancelar').addEventListener('click', fecharModal)
  el('overlay').addEventListener('click', (e) => { if (e.target.id === 'overlay') fecharModal() })
  el('form-canteiro').addEventListener('submit', salvar)
  el('busca').addEventListener('input', renderizar)
  el('filtro-status').addEventListener('change', renderizar)

  if (window.lucide) lucide.createIcons()
  carregarCultivosParaSelect().then(carregarCanteiros)
}

iniciar()
