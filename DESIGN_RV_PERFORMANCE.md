# RV 30 — Performance Contemporânea (implementação visual)

## Direção aprovada
A marca fornecida é branca e turquesa. Cor de destaque obtida da imagem: aproximadamente `#00BBB1`; fundo grafite `#08151E`; superfícies claras no checkout `#EDF2F1`. O redesign remove o laranja das referências preliminares. A logo original permanece como arquivo local `/public/logo-rv.png`.

## Entrega deste ramo
- **Landing**: título de impacto, valor total prioritário, CTA funcional existente, fotografia real já existente da Rosangela (arquivo do repositório), histórico de oferta e ressalvas preservados, seções com tratamento editorial menos genérico.
- **Checkout**: formulário original com nome/e-mail/WhatsApp/aceite, resumo da compra antes do formulário no mobile, valor total R$ 399 conforme configuração vigente, e encaminhamento ao provedor já implementado — **sem acrescentar campos de cartão, garantias ou meios de pagamento fictícios**.
- **Aluno**: navegação por dia, progresso, vídeo, informações, orientações, conclusão e comentários preservados. A calculadora cardíaca do PR #1 passa a ficar após o player e o resumo da aula, priorizando o conteúdo.
- **Tipografia**: Barlow Condensed (títulos) + Manrope (interface) com fallback. Carregamento Google Fonts com escopos de CSP restritos a fonts.googleapis.com / fonts.gstatic.com.
- **CSS**: camada específica `assets/css/rv-performance.css` importada **depois** dos estilos legados para permitir reversão simples sem modificar a lógica.
- **Responsividade**: breakpoints próprios para 320, 360, 390, 700, 900, 1100 px; progresso e cursos mantêm layout adaptado; leitura e botões sensíveis ao toque.

## Preservação e avaliação
Esta alteração não modifica a lógica de negócio, o script do gateway, autenticação, autorizações, o processo de publicação dos 31 vídeos, nem o algoritmo de Karvonen. Mantém `data-buy`, `data-order-total`, `data-checkout-form`, `data-course-video`, `data-complete`, `data-cardio-section` e os demais hooks. A mudança de ordem DOM no checkout mantém a leitura mobile alinhada à navegação por teclado. Foi adicionada verificação E2E do tema, checkout e ordem de vídeo/calculadora.

## Avisos antes das vendas
**Design implementado não significa lançamento liberado.** A branch base ainda é uma demonstração: depende de backend seguro, integração real do gateway e confirmação server-side, controle de matrículas, privacidade/LGPD e streaming privado. A falha prévia de sincronização de suporte entre abas possui issue #2 aberta. Testar também perfis e autorização das fotografias e possíveis alegações sobre perda de peso com a profissional responsável.

## Para testar
```bash
npm ci
npm test
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
```

Documentação e propostas não substituem revisão humana em Chrome/Edge/Safari desktop e Android/iOS reais. O fluxo de pagamento não será simulado como compra real em produção.
