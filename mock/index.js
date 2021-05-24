const bleno = require("@abandonware/bleno");
const BlenoPrimaryService = bleno.PrimaryService;
const CustomCharacteristic = require("./characteristic");

const name = "bleno mock";
const serviceUUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";

bleno.on("stateChange", function (state) {
  if (state === "poweredOn") {
    bleno.startAdvertising(name, [serviceUUID]);
  } else {
    bleno.stopAdvertising();
  }
});

bleno.on("advertisingStart", function (error) {
  if (!error) {
    bleno.setServices([
      new BlenoPrimaryService({
        uuid: serviceUUID,
        characteristics: [new CustomCharacteristic()],
      }),
    ]);
  }
});
