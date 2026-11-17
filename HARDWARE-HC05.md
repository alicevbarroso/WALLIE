# WALLIE e HC-05

## O que os botões fazem

O botão envia START e STOP por Bluetooth Classic. O Arduino devolve STATE:ON ou STATE:OFF; o app só muda o indicador quando recebe essa resposta. STATUS pede o estado atual.

START ativa a rotina autônoma de desvio de obstáculos. STOP para os motores. Isso não corta a alimentação do Arduino nem do HC-05: para desligar eletricamente o robô, é necessário um circuito de chaveamento de alimentação próprio.

## Ligação usada pelo sketch

- HC-05 TXD -> Arduino Uno A2 (RX do SoftwareSerial).
- Arduino Uno A3 (TX do SoftwareSerial) -> divisor de tensão -> HC-05 RXD. A entrada RX do HC-05 é lógica de 3,3 V; não ligue o TX de 5 V do Uno diretamente sem confirmar que sua placa HC-05 aceita esse nível.
- VCC e GND do HC-05 conforme a placa breakout; GND comum entre Uno, HC-05 e alimentação do robô.
- DHT22 DATA -> pino 4. O sketch original usava pino 7 para DHT22 e para IN4 do driver ao mesmo tempo; este sketch move o DHT22 para o pino 4.
- O ultrassom continua nos pinos 3 (TRIG) e 2 (ECHO); o servo no 5; o sensor de chama no 13.

O HC-05 deixa de usar os pinos 0/1. A porta Serial USB fica disponível para depuração.

## Preparar e usar

1. No celular Android, emparelhe o HC-05 nas configurações Bluetooth. O PIN costuma ser 1234 ou 0000, conforme a configuração do módulo.
2. Carregue Wallie_HC05.ino no Arduino Uno com a biblioteca DHT sensor library instalada.
3. Para criar a build Android de desenvolvimento, entre na sua conta Expo com npx eas-cli login e rode npx eas-cli build --platform android --profile development. O serviço EAS gera um APK para instalar no telefone. Expo Go não inclui o módulo nativo necessário para Bluetooth Classic.
4. Depois de instalar o APK, inicie o projeto com npx expo start --dev-client, abra WALLIE no celular, toque em Conectar por Bluetooth e escolha o HC-05 emparelhado. Depois use Ligar Wallie / Desligar Wallie.

## Limites conhecidos

- O sketch não mede a tensão da bateria, então o app ainda não consegue mostrar a porcentagem real. Será necessário um divisor resistivo ligado a uma entrada analógica e calibrar a leitura para a bateria usada.
- KY-026 é sensor de chama; o valor dele não confirma fumaça.
- O sensor de chama e o DHT22 reportam leituras a cada 2 segundos. A rotina de desvio tem delays bloqueantes, portanto comandos e leituras podem chegar atrasados enquanto o robô manobra.
- A ligação para 193 é sempre iniciada pela pessoa no celular após confirmação; o app não chama os Bombeiros sozinho.

