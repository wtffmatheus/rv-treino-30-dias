'use strict'
// Ferramenta de REVISAO PRIVADA dos videos - nunca embutir o manifesto no site.
// Uso: node scripts/check-private-videos.js /caminho/externo/manifesto.json
const fs = require('node:fs')

function parseDriveUrl(link) {
  if (typeof link !== 'string' || !link.trim()) return null
  try {
    const url = new URL(link)
    if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com' ||
        url.username || url.password || url.port) return null
    const m = url.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]{10,})\/?(?:(?:view|preview)\/?)?$/)
    if (!m) return null
    return m[1]
  } catch { return null }
}
function parseDay(name) {
  const normalized = String(name || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (!/\.(?:mov|mp4|m4v|webm)$/.test(normalized)) return null
  const stem = normalized.replace(/\.[^.]+$/, '')
  if ((stem.match(/\d+/g) || []).length !== 1) return null
  const match = stem.match(/^(?:(?:video[ _-]*)?(?:aula|dia)[ _-]*)?(\d{1,3})(?=[ _.-]|$)/)
  return match ? Number(match[1]) : null
}
function validate(manifest) {
  const findings = []
  const items = manifest?.items
  if (manifest?.schemaVersion !== 1 || manifest.courseId !== 'rv30' || !Array.isArray(items) || items.length > 1000) {
    return {
      readyForEditorialReview:false, linked:0, missingDays:Array.from({length:30},(_,i)=>i+1),
      problems:['Formato invalido: schemaVersion 1, courseId rv30, items array sao necessarios.']
    }
  }
  const counts = new Map(), links = new Map(), candidates = []
  for (const entry of items) {
    const day = parseDay(entry?.name)
    if (day === null || day < 0 || day > 30) { findings.push('Numeração ausente, ambígua ou fora de 0 a 30. Use MOV, MP4, M4V ou WEBM.'); continue }
    if (Object.hasOwn(entry, 'day') && entry.day !== day) { findings.push('Dia declarado divergente do nome no dia ' + day + '.'); continue }
    counts.set(day, (counts.get(day)||0)+1)
    const raw = String(entry.driveUrl??'')
    if (!raw.trim()) {
      if (day === 0) findings.push('A introdução foi incluída, mas ainda não tem link privado válido.')
      candidates.push({ day, id: null })
      continue
    }
    const id = parseDriveUrl(raw)
    if (!id) {
      findings.push('URL do Drive invalida no dia ' + day + '.')
      candidates.push({ day, id: null })
      continue
    }
    if (!links.has(id)) links.set(id, [])
    links.get(id).push(day)
    candidates.push({ day, id })
  }
  for(const [day,count] of counts) if(count!==1) findings.push('Dia repetido no manifesto: '+day+'.')
  for (const days of links.values()) if (days.length > 1) findings.push('O mesmo arquivo está vinculado aos dias ' + days.join(', ') + '; todas as associações conflitantes foram excluídas da contagem.')
  const valid = candidates.filter(item => item.id && counts.get(item.day) === 1 && links.get(item.id)?.length === 1)
  const linkedDays = valid.filter(item => item.day >= 1).map(item => item.day).sort((a, b) => a - b)
  const missingDays = Array.from({length:30},(_,i)=>i+1).filter(day => !linkedDays.includes(day))
  return {
    readyForEditorialReview:missingDays.length===0&&findings.length===0,
    linked:linkedDays.length,
    linkedDays, missingDays, introLinked:valid.some(item => item.day === 0), problems:findings
  }
}
if (require.main === module) {
  const file = process.argv[2]
  if (!file) {
    console.error('Informe o caminho para o manifesto PRIVADO, fora da pasta do site.')
    process.exitCode=2
  } else {
    try {
      const result=validate(JSON.parse(fs.readFileSync(file,'utf8')))
      // A saida nunca imprime URLs, IDs ou detalhes privados dos arquivos.
      console.log(JSON.stringify(result,null,2))
      if (!result.readyForEditorialReview) process.exitCode=2
    } catch {
      console.error('Nao foi possivel abrir ou validar o manifesto privado.')
      process.exitCode=2
    }
  }
}
module.exports={parseDriveUrl,parseDay,validate}
