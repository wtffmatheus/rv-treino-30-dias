'use strict'
// Generate an identifiable, decodable test clip for the private local bucket.
const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')
async function main() {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    const bytes = await page.evaluate(async () => {
      const canvas = document.createElement('canvas')
      canvas.width=640; canvas.height=360
      const ctx=canvas.getContext('2d')
      const stream=canvas.captureStream(24)
      const audio=new AudioContext()
      await audio.resume()
      const destination=audio.createMediaStreamDestination(),oscillator=audio.createOscillator(),gain=audio.createGain()
      gain.gain.value=.025; oscillator.frequency.value=220
      oscillator.connect(gain).connect(destination); oscillator.start()
      stream.addTrack(destination.stream.getAudioTracks()[0])
      const recorder=new MediaRecorder(stream,{mimeType:'video/mp4'})
      const chunks=[]
      recorder.ondataavailable=e=>chunks.push(e.data)
      const done=new Promise(resolve=>recorder.onstop=resolve)
      recorder.start()
      for(let i=0;i<72;i++) {
        ctx.fillStyle='#152B3D';ctx.fillRect(0,0,640,360)
        ctx.fillStyle='#F3F8FC';ctx.font='32px sans-serif';ctx.fillText('Vídeo de validação local',52,174)
        ctx.fillStyle='#67D7F6';ctx.fillRect(52,210,535*i/71,5)
        await new Promise(resolve=>setTimeout(resolve,42))
      }
      recorder.stop();await done;oscillator.stop();await audio.close()
      return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))
    })
    const dir=path.join(__dirname,'../output/codex-redesign-completo/qa')
    fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'midia-validacao.mp4'),Buffer.from(bytes))
  } finally {await browser.close()}
}
main().catch(e=>{console.error(e.message);process.exitCode=1})

