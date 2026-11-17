#include <Servo.h>
#include <DHT.h>
#include <SoftwareSerial.h>

// HC-05 no Arduino Uno: HC-05 TXD -> A2; Arduino A3 -> divisor de tensão -> HC-05 RXD.
#define BT_RX A2
#define BT_TX A3
SoftwareSerial BT(BT_RX, BT_TX);

// Ultrassom
#define trigPin 3
#define echoPin 2

// Driver dos motores
#define IN1 10
#define IN2 9
#define IN3 8
#define IN4 7
#define ENA 11
#define ENB 6

// Servo e sensores
#define servoPin 5
#define FLAME_PIN 13
#define DHTPIN 4 // O pino 7 era compartilhado com IN4; foi movido para 4.
#define DHTTYPE DHT22

Servo myServo;
DHT dht(DHTPIN, DHTTYPE);

int speedLeft = 10;
int speedRight = 10;

bool Liga = false;
unsigned long ultimaLeituraSensores = 0;
const unsigned long INTERVALO_SENSORES = 2000;

void stopCar();
void forward();
void backward();
void turnRight();
void turnLeft();
int getDistance();
int lookRight();
int lookLeft();

void publishState() {
  BT.print("STATE:");
  BT.println(Liga ? "ON" : "OFF");
}

void processBluetoothCommands() {
  while (BT.available() > 0) {
    String command = BT.readStringUntil('\n');
    command.trim();
    command.toUpperCase();

    if (command == "START") {
      Liga = true;
      publishState();
    } else if (command == "STOP") {
      Liga = false;
      stopCar();
      publishState();
    } else if (command == "STATUS") {
      publishState();
    } else if (command.length() > 0) {
      BT.println("ERROR:UNKNOWN_COMMAND");
    }
  }
}

void delayWhileResponsive(unsigned long duration) {
  unsigned long started = millis();
  while (millis() - started < duration) {
    processBluetoothCommands();
    if (!Liga) {
      stopCar();
      return;
    }
    delay(10);
  }
}

void publishSensors() {
  bool chama = (digitalRead(FLAME_PIN) == LOW);
  BT.print("FIRE:");
  BT.println(chama ? "1" : "0");

  float temp = dht.readTemperature();
  float humi = dht.readHumidity();
  if (isnan(temp) || isnan(humi)) {
    BT.println("TEMP:ERR");
    BT.println("HUMIDITY:ERR");
  } else {
    BT.print("TEMP:");
    BT.println(temp, 1);
    BT.print("HUMIDITY:");
    BT.println(humi, 1);
    if (temp >= 50.0) {
      BT.println("ALERT:TEMP_CRITICAL");
    }
  }
}

void setup() {
  Serial.begin(9600); // Porta USB para depuração; o HC-05 não usa os pinos 0/1.
  BT.begin(9600);
  BT.setTimeout(50);
  dht.begin();

  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(FLAME_PIN, INPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);
  pinMode(ENA, OUTPUT);
  pinMode(ENB, OUTPUT);

  myServo.attach(servoPin);
  myServo.write(90);
  stopCar();
  delay(1000);
  Serial.println("WALLIE pronto. Comandos Bluetooth: START, STOP, STATUS.");
}

void loop() {
  processBluetoothCommands();

  // Os sensores continuam monitorados mesmo quando a movimentação está parada.
  if (millis() - ultimaLeituraSensores >= INTERVALO_SENSORES) {
    ultimaLeituraSensores = millis();
    publishSensors();
  }

  if (Liga) {
    int frontDist = getDistance();
    if (frontDist > 25) {
      forward();
    } else {
      stopCar();
      delayWhileResponsive(100);
      if (!Liga) return;
      backward();
      delayWhileResponsive(300);
      if (!Liga) return;
      stopCar();
      delay(50);
      int rightDist = lookRight();
      int leftDist = lookLeft();
      if (!Liga) return;
      if (rightDist > leftDist) {
        turnRight();
      } else {
        turnLeft();
      }
      stopCar();
      delay(50);
    }
  } else {
    stopCar();
  }
}

int getDistance() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  long duration = pulseIn(echoPin, HIGH, 25000);
  if (duration == 0) return 200;
  return duration * 0.034 / 2;
}

int lookRight() {
  myServo.write(10);
  delayWhileResponsive(300);
  if (!Liga) return 0;
  int d = getDistance();
  myServo.write(90);
  delayWhileResponsive(200);
  return d;
}

int lookLeft() {
  myServo.write(170);
  delayWhileResponsive(300);
  if (!Liga) return 0;
  int d = getDistance();
  myServo.write(90);
  delayWhileResponsive(200);
  return d;
}

void forward() {
  analogWrite(ENA, speedRight);
  analogWrite(ENB, speedLeft);
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, LOW);
}

void backward() {
  analogWrite(ENA, speedRight);
  analogWrite(ENB, speedLeft);
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, HIGH);
}

void turnRight() {
  analogWrite(ENA, speedRight);
  analogWrite(ENB, speedLeft);
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH);
  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, LOW);
  delayWhileResponsive(400);
}

void turnLeft() {
  analogWrite(ENA, speedRight);
  analogWrite(ENB, speedLeft);
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, HIGH);
  delayWhileResponsive(400);
}

void stopCar() {
  analogWrite(ENA, 0);
  analogWrite(ENB, 0);
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, LOW);
}


