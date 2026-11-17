# WALLIE

Projeto acadêmico de robótica móvel e sistemas embarcados. O WALLIE combina um Arduino Uno com sensores, acionamento de motores e comunicação Bluetooth Classic por HC-05, além de um aplicativo Android feito com Expo e React Native.

> O sketch e o aplicativo existentes são a referência para o comportamento descrito aqui. A interface ainda contém telas e controles demonstrativos; consulte [limitações](#limitações-conhecidas) antes de interpretar seus indicadores como telemetria real.

## Objetivo

Explorar movimentação autônoma com desvio de obstáculos, monitoramento ambiental e interação com um aplicativo móvel em uma plataforma robótica educacional.

## Arquitetura

- **Robô:** Arduino Uno executa o sketch `Wallie_HC05.ino`, lê os sensores e controla o driver dos motores e o servo.
- **Comunicação:** HC-05 usa Bluetooth Classic serial (9600 bps) para comandos e mensagens de estado/sensores.
- **Aplicativo:** Expo/React Native, com módulo nativo `react-native-bluetooth-classic`; a configuração EAS define builds Android internas.
- **Protocolo observado:** comandos `START`, `STOP`, `STATUS`; respostas `STATE:ON/OFF`, `FIRE`, `TEMP`, `HUMIDITY` e alertas de temperatura.

## Componentes documentados

Os arquivos identificam Arduino Uno, módulo HC-05, driver de motores, motores, sensor ultrassônico, servo, DHT22 e sensor de chama. O sketch configura ultrassom nos pinos 3/2, driver nos pinos 10/9/8/7 e PWM 11/6, servo no 5, chama no 13 e DHT22 no 4. A serial Bluetooth usa A2/A3.

Consulte [HARDWARE-HC05.md](HARDWARE-HC05.md) para as ligações descritas no documento existente. Este README não substitui a validação física da montagem. A versão do documento registra que DHT22 foi movido ao pino 4 para evitar conflito com IN4 no pino 7; o sketch atual confirma essa configuração.

## Funcionalidades confirmadas nos arquivos

- **Movimentação autônoma:** `START` ativa a rotina; o robô avança quando a distância frontal é maior que 25 cm.
- **Desvio de obstáculos:** se a distância for menor ou igual a 25 cm, o robô recua e mede os lados usando o ultrassom montado no servo, escolhendo o lado com maior distância medida.
- **Controle pelo aplicativo:** o app Android pode conectar a um HC-05 previamente emparelhado e envia `START`, `STOP` e `STATUS`. O Arduino publica a confirmação de estado. `STOP` para os motores, sem cortar alimentação.
- **Temperatura e umidade:** DHT22 é lido a cada dois segundos e os valores são enviados ao app. O sketch emite `ALERT:TEMP_CRITICAL` a partir de 50 °C.
- **Sensor de chama:** entrada digital ativa em nível baixo é enviada como `FIRE:1` ou `FIRE:0`; o app pode exibir alerta e oferecer ligação para 193 após ação/confirmação da pessoa.

## Aplicativo e dependências

O aplicativo está em `App.js`; metadados e dependências estão em `app.json`, `eas.json`, `package.json` e `package-lock.json`. As dependências declaradas incluem Expo, React Native, `expo-dev-client`, `react-native-bluetooth-classic`, `with-rn-bluetooth-classic` e Axios.

O módulo de Bluetooth Classic exige build Android própria com o módulo nativo. O código do app informa que Expo Go não oferece essa integração. Pré-requisitos e fluxo detalhados estão em [HARDWARE-HC05.md](HARDWARE-HC05.md). Resumo do fluxo configurado:

1. Emparelhe o HC-05 nas configurações Bluetooth do Android.
2. Instale dependências com `npm install`.
3. Autentique no EAS e gere a build de desenvolvimento com `npx eas-cli build --platform android --profile development`.
4. Inicie com `npx expo start --dev-client`, abra o app instalado, conecte ao HC-05 e use os controles de ligar/desligar.

## Uso do robô

Com a montagem física revisada e o sketch carregado no Uno, conecte o app ao HC-05. `START` inicia a rotina autônoma; `STOP` interrompe os motores; `STATUS` solicita o estado atual. Sensores reportam periodicamente mesmo quando a movimentação está parada. Não há procedimento de segurança funcional ou ensaio documentado neste repositório; faça a operação com supervisão e em ambiente controlado.

## Apresentação acadêmica

O projeto será apresentado nesta documentação como tendo sido exibido em evento da Marinha do Brasil somente após confirmação de dados como nome do evento, data e autorização para divulgação. Esses detalhes não constam nos arquivos atualmente disponíveis. Não foram encontradas fotos ou vídeos de demonstração neste inventário.

## Possíveis evoluções assistivas — propostas futuras

Como possibilidades de pesquisa futura, podem ser estudadas interfaces acessíveis, navegação assistiva e alertas ambientais para apoio a pessoas. Essas ideias não são funcionalidades implementadas ou validadas pelo WALLIE atual e não devem ser entendidas como dispositivo médico ou solução de segurança.

## Limitações conhecidas

- O app ainda mostra dados demonstrativos em partes da interface, incluindo atividade, bateria, sensores/alertas, navegação e mapeamento. O próprio app identifica áreas que não recebem dados reais do robô.
- Os controles direcionais são demonstrativos e não enviam comandos aos motores; o protocolo implementado controla início/parada da rotina autônoma.
- A porcentagem de bateria não é medida pelo sketch.
- O sensor de chama não mede fumaça. O limiar de temperatura no sketch é 50 °C.
- Delays da rotina de manobra podem atrasar comandos Bluetooth e leituras.
- Não foram encontrados arquivos de foto/vídeo no conjunto inspecionado. Adicione mídia a `docs/media/` somente após confirmar autorização e remover informações pessoais/sensíveis.
- Não há evidência nos arquivos de testes de hardware, validação de segurança ou resultados quantitativos; nenhum resultado é alegado aqui.

## Estrutura

```text
.
├── Wallie_HC05.ino
├── App.js
├── app.json
├── eas.json
├── package.json
├── package-lock.json
├── HARDWARE-HC05.md
└── docs/
    └── media/
```

O diretório `backup-inicial-20261112-232542/` é uma cópia local de dependências de uma versão anterior, não é necessário para a instalação descrita e deve permanecer fora do repositório.
