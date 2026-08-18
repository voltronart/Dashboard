import { supabase } from './config.js'
import { montarSidebar } from './sidebar.js'

let cultivos = []
let editandoId = null

const el = (id) => document.getElementById(id)
const lista = () => el('lista')
const estadoVazio = () => el('estado-vazio')
const estadoCarregando = () => el('estado-carregando')
const contagem = () => el('contagem')
const alerta = () => el('alerta')

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

async function carregarCultivos(){
  estadoCarregando().style.display = 'block'
  lista().innerHTML = ''
  estadoVazio().style.display = 'none'

  const { data, error } = await supabase
    .from('cultivos')
    .select('*')
    .order('nome', { ascending: true })

  estadoCarregando().style.display = 'none'

  if (error){
    mostrarErro('Não foi possível carregar os cultivos agora.')
    return
  }
  cultivos = data || []
  renderizar()
}

function renderizar(){
  const termo = el('busca').value.toLowerCase()
  const filtrados = cultivos.filter(c =>
    `${c.nome} ${c.variedade || ''}`.toLowerCase().includes(termo)
  )

  lista().innerHTML = ''

  if (filtrados.length === 0){
    estadoVazio().style.display = 'block'
    el('texto-vazio').textContent = cultivos.length === 0
      ? 'Nenhum cultivo cadastrado ainda. Comece adicionando o primeiro.'
      : 'Nenhum cultivo encontrado para essa busca.'
  } else {
    estadoVazio().style.display = 'none'
    filtrados.forEach(c => lista().appendChild(criarItem(c)))
  }

  contagem().textContent = cultivos.length > 0
    ? `${cultivos.length} cultivo${cultivos.length !== 1 ? 's' : ''} cadastrado${cultivos.length !== 1 ? 's' : ''} · dados salvos no Supabase`
    : ''

  if (window.lucide) lucide.createIcons()
}

function criarItem(c){
  const div = document.createElement('div')
  div.className = 'item'

  const meta = []
  if (c.ciclo_dias) meta.push(`🕐 ${c.ciclo_dias} dias de ciclo`)
  if (c.espacamento) meta.push(`📏 ${c.espacamento}`)
  if (c.epoca_plantio) meta.push(`🌱 Plantio: ${c.epoca_plantio}`)
  if (c.necessidade_irrigacao) meta.push(`💧 Irrigação ${c.necessidade_irrigacao.toLowerCase()}`)

  div.innerHTML = `
    <div class="item-info">
      <div class="item-title">
        <h3>${escapeHtml(c.nome)}</h3>
        ${c.variedade ? `<span>${escapeHtml(c.variedade)}</span>` : ''}
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
  el('modal-titulo').textContent = 'Novo cultivo'
  el('form-cultivo').reset()
  el('f-irrigacao').value = 'Média'
  el('overlay').classList.add('open')
}

function abrirEdicao(c){
  editandoId = c.id
  el('modal-titulo').textContent = 'Editar cultivo'
  el('f-nome').value = c.nome || ''
  el('f-variedade').value = c.variedade || ''
  el('f-ciclo').value = c.ciclo_dias || ''
  el('f-epoca').value = c.epoca_plantio || ''
  el('f-espacamento').value = c.espacamento || ''
  el('f-plantas').value = c.plantas_por_canteiro || ''
  el('f-produtividade').value = c.produtividade_media || ''
  el('f-irrigacao').value = c.necessidade_irrigacao || 'Média'
  el('f-adubacao').value = c.adubacao || ''
  el('f-pragas').value = c.pragas_doencas || ''
  el('f-preco').value = c.epoca_melhor_preco || ''
  el('overlay').classList.add('open')
}

function fecharModal(){
  el('overlay').classList.remove('open')
  editandoId = null
}

async function salvar(e){
  e.preventDefault()
  const nome = el('f-nome').value.trim()
  if (!nome) return

  const btn = el('btn-salvar')
  btn.disabled = true
  btn.textContent = 'Salvando...'

  const registro = {
    nome,
    variedade: el('f-variedade').value.trim() || null,
    ciclo_dias: el('f-ciclo').value ? parseInt(el('f-ciclo').value) : null,
    epoca_plantio: el('f-epoca').value.trim() || null,
    espacamento: el('f-espacamento').value.trim() || null,
    plantas_por_canteiro: el('f-plantas').value ? parseInt(el('f-plantas').value) : null,
    produtividade_media: el('f-produtividade').value.trim() || null,
    necessidade_irrigacao: el('f-irrigacao').value,
    adubacao: el('f-adubacao').value.trim() || null,
    pragas_doencas: el('f-pragas').value.trim() || null,
    epoca_melhor_preco: el('f-preco').value.trim() || null,
  }

  let error
  if (editandoId){
    ({ error } = await supabase.from('cultivos').update(registro).eq('id', editandoId))
  } else {
    ({ error } = await supabase.from('cultivos').insert(registro))
  }

  btn.disabled = false
  btn.textContent = 'Salvar cultivo'

  if (error){
    mostrarErro('Não foi possível salvar este cultivo. Tente novamente.')
    return
  }

  fecharModal()
  await carregarCultivos()
}

async function excluir(id){
  const { error } = await supabase.from('cultivos').delete().eq('id', id)
  if (error){
    mostrarErro('Não foi possível excluir este cultivo.')
    return
  }
  cultivos = cultivos.filter(c => c.id !== id)
  renderizar()
}

function iniciar(){
  montarSidebar('cultivos')

  el('btn-novo').addEventListener('click', abrirNovo)
  el('btn-fechar').addEventListener('click', fecharModal)
  el('btn-cancelar').addEventListener('click', fecharModal)
  el('overlay').addEventListener('click', (e) => { if (e.target.id === 'overlay') fecharModal() })
  el('form-cultivo').addEventListener('submit', salvar)
  el('busca').addEventListener('input', renderizar)

  if (window.lucide) lucide.createIcons()
  carregarCultivos()
}

iniciar()
