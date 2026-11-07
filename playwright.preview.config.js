'use strict'
const {defineConfig}=require('@playwright/test')
if(!process.env.BASE_URL)throw new Error('Defina BASE_URL com o preview exato que será validado.')
const url=new URL(process.env.BASE_URL)
if(url.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(url.hostname))throw new Error('A homologação remota exige HTTPS.')
module.exports=defineConfig({
 testDir:'./tests/preview',timeout:60000,workers:1,
 outputDir:'output/preview-results',reporter:[['list'],['json',{outputFile:'output/preview-results.json'}]],
 use:{baseURL:url.origin,viewport:{width:1440,height:900},reducedMotion:'reduce',screenshot:'off',trace:'off',...(process.env.QA_STORAGE_STATE?{storageState:process.env.QA_STORAGE_STATE}:{})}
})
