#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;

#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"



//#define TRAFFIC_LIGHTS_MODE
#define BUS_MODE

#ifdef TRAFFIC_LIGHTS_MODE
#define SECONDS_TO_CHANGE_RED_LIGHTS 9
#define SECONDS_TO_CHANGE_GREEN_LIGHTS 7
char buffer[512];
int secondsToChange = 10;
bool state = false;
#endif

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      pServer->startAdvertising();
    };

    void onDisconnect(BLEServer* pServer) {
    }
};

void setup() {
  Serial.begin(115200);

  // Create the BLE Device
  BLEDevice::init("ESP32");

  // Create the BLE Server
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  // Create the BLE Service
  BLEService *pService = pServer->createService(SERVICE_UUID);

  // Create a BLE Characteristic
  pCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_READ   |
                      BLECharacteristic::PROPERTY_WRITE  |
                      BLECharacteristic::PROPERTY_NOTIFY |
                      BLECharacteristic::PROPERTY_INDICATE
                    );

  // https://www.bluetooth.com/specifications/gatt/viewer?attributeXmlFile=org.bluetooth.descriptor.gatt.client_characteristic_configuration.xml
  // Create a BLE Descriptor
  pCharacteristic->addDescriptor(new BLE2902());

  // Start the service
  pService->start();

  // Start advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(false);
  pAdvertising->setMinPreferred(0x0);  // set value to 0x00 to not advertise this parameter
  BLEDevice::startAdvertising();
  Serial.println("Waiting a client connection to notify...");
}

void loop() {
  #ifdef BUS_MODE
  pCharacteristic->setValue("{\"type\":\"BUS\",\"route\":\"139\",\"direction\":\"Miasteczko Studenckie AGH\"}");
  #endif
  
  #ifdef TRAFFIC_LIGHTS_MODE
  secondsToChange--;
  if (secondsToChange <= 0) {
    state = !state;
    if (state) secondsToChange = SECONDS_TO_CHANGE_GREEN_LIGHTS;
    else secondsToChange = SECONDS_TO_CHANGE_RED_LIGHTS;
  }

  sprintf(buffer, "{\"type\":\"TRAFFIC_LIGHTS\",\"color\":\"%s\",\"seconds\":%d}",
    state ? "GREEN" : "RED",
    secondsToChange);
    
  pCharacteristic->setValue(buffer);
  pCharacteristic->notify();
  delay(1000);
  #endif
}
