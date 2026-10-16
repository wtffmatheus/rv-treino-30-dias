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
    const m = url.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]{10,})\/?(?:view)?\/?$/)
    if (!m) return null
    return m[1]
  } catch { return null }
}
function validate(manifest) {
  const findings = []
  const items = manifest?.items
  if (manifest?.schemaVersion !== 1 || manifest.courseId !== 'rv30' || !Array.isArray(items)) {
    return {
      readyForEditorialReview:false, linked:0, missingDays:Array.from({length:30},(_,i)=>i+1),
      problems:['Formato invalido: schemaVersion 1, courseId rv30, items array sao necessarios.']
    }
  }
  const counts = new Map(), links = new Map()
  for (const entry of items) {
    const name = String(entry?.name ?? '')
    const match = name.match(/^(\d{1,2})\.mov$/i)
    const day = match ? Number(match[1]) : 0
    if (day < 1 || day > 30) { findings.push('Nome fora do padrao de 1.MOV a 30.MOV.'); continue }
    counts.set(day, (counts.get(day)||0)+1)
    const raw = String(entry.driveUrl??'')
    if (!raw.trim()) continue
    const id = parseDriveUrl(raw)
    if (!id) {
      findings.push('URL do Drive invalida no dia ' + day + '.')
      continue
    }
    if (!links.has(id)) links.set(id, day)
    else findings.push('O mesmo arquivo esta vinculado a mais de um dia.')
  }
  const missingDays = Array.from({length:30},(_,i)=>i+1).filter(day=>
    counts.get(day)!==1 ||
    !items.some(e=>Number(String(e?.name||'').match(/^(\d{1,2})\.mov$/i)?.[1])===day&&parseDriveUrl(e.driveUrl))
  )
  if (items.length!==30) findings.push('Esperados exatamente 30 arquivos, encontrados '+items.length+'.')
  for(const [day,count] of counts) if(count!==1) findings.push('Dia repetido no manifesto: '+day+'.')
  return {
    readyForEditorialReview:missingDays.length===0&&findings.length===0,
    linked:30-missingDays.length,
    missingDays, problems:findings
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
module.exports={parseDriveUrl,validate}
