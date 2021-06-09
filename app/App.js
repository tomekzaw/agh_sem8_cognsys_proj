/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

import {
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {BleManager} from 'react-native-ble-plx';
import React from 'react';
import Tts from 'react-native-tts';
import base64 from 'react-native-base64';

const bleManager = new BleManager();
const serviceUUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const characteristicUUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

class Say {
  constructor(what) {
    this.what = what;
  }

  run(deviceContext) {
    Tts.speak(this.what);
  }
}

class DisplayText {
  constructor(text, textColor, backgroundColor) {
    this.text = text;
    this.textColor = textColor;
    this.backgroundColor = backgroundColor;
  }

  run(deviceContext) {
    deviceContext.setText(this.text, this.textColor, this.backgroundColor);
  }
}

class PublicTransportVehicle {
  onAppear(current) {
    const text = `Przyjechał autobus ${current.route}, kierunek ${current.direction}.`;
    return [new Say(text), new DisplayText(current.route, 'black', 'cyan')];
  }

  onDisappear(previous) {
    const text = `Autobus ${previous.route} odjechał.`;
    return [new Say(text), new DisplayText(text, 'black', 'cyan')];
  }

  onChange(previous, current) {
    if (previous.state !== current.state) {
      if (current.state === 'DOORS_OPEN') {
        const text = 'Drzwi otwierają się.';
        return [new Say(text), new DisplayText('[  ]', 'black', 'cyan')];
      }
      if (current.state === 'LEAVING') {
        const text = `Autobus ${current.route} odjechał.`;
        return [new Say(text), new DisplayText('-->', 'black', 'cyan')];
      }
    }
  }
}

class TrafficLights {
  onAppear(current) {
    return this.onChange({...current, color: null}, current);
  }

  onDisappear(previous) {
    return [new DisplayText('', 'black', 'gray')];
  }

  onChange(previous, current) {
    const color = current.color === 'GREEN' ? 'zielone' : 'czerwone';
    const text = `Światło ${color}. Pozostało ${current.seconds} sekund.`;
    const textColor = current.color === 'GREEN' ? 'black' : 'white';
    const backgroundColor = current.color === 'GREEN' ? 'lime' : 'red';
    const displayTextAction = new DisplayText(
      current.seconds,
      textColor,
      backgroundColor,
    );
    if (previous.color !== current.color) {
      return [new Say(text), displayTextAction];
    } else {
      return [displayTextAction];
    }
  }
}

function createBeacon(type) {
  switch (type) {
    case 'BUS':
      return new PublicTransportVehicle();
    case 'TRAFFIC_LIGHTS':
      return new TrafficLights();
    default:
      console.log(`Unknown beacon type ${type}`);
  }
}

const App = () => {
  const [devices, setDevices] = React.useState([]);
  const devicesRef = React.useRef({});

  const updateUI = () => {
    setDevices(Object.values(devicesRef.current));
  };

  const addDevice = device => {
    devicesRef.current[device.id] = {
      device,
      value: null,
      subscription: null,
    };
    updateUI();
  };

  const hasDevice = device => {
    return device.id in devicesRef.current;
  };

  const updateDeviceData = (device, value, rssi) => {
    devicesRef.current[device.id] = {
      ...devicesRef.current[device.id],
      value,
      rssi,
    };
    updateUI();
  };

  const updateDeviceText = (device, text, textColor, backgroundColor) => {
    devicesRef.current[device.id] = {
      ...devicesRef.current[device.id],
      text,
      textColor,
      backgroundColor,
    };
    updateUI();
  };

  const getDeviceValue = device => {
    return devicesRef.current[device.id].value;
  };

  const updateDeviceSubscription = (device, subscription) => {
    devicesRef.current[device.id] = {
      ...devicesRef.current[device.id],
      subscription,
    };
    updateUI();
  };

  const deleteDevice = device => {
    // TODO: move cleanup logic somewhere else
    // TODO: use device.onDisconnected?
    const {subscription} = devicesRef.current[device.id];
    delete devicesRef.current[device.id];
    if (subscription) {
      subscription.remove();
    }
    (async () => {
      if (await device.isConnected()) {
        console.log(`Cancelling connection with ${device.id}`);
        await device.cancelConnection();
      }
    })();
    updateUI();
  };

  const asyncHandleConnect = async (error, device) => {
    if (error) {
      // TODO: handle Bluetooth adapter or Location off
      console.log(JSON.stringify(error));
      return;
    }

    if (hasDevice(device)) {
      // console.log(`Duplicate of ${device.id}`);
      // device already connected (prevent duplication)
      return;
    }

    addDevice(device);

    device.onDisconnected(() => console.log(`Disconnected ${device.id}`));

    try {
      console.log(`Detected ${device.id}`);

      await bleManager.connectToDevice(device.id, {requestMTU: 512});
      console.log(`Connected to ${device.id}`);

      await device.discoverAllServicesAndCharacteristics();
      console.log(`Discovered ${device.id}`);

      const characteristic = await device.readCharacteristicForService(
        serviceUUID,
        characteristicUUID,
      );
      const value = base64.decode(characteristic.value);
      console.log(`Read characteristic for ${device.id}: ${value}`);

      device = await device.readRSSI();
      console.log(`RSSI for ${device.id}: ${device.rssi}`);

      updateDeviceData(device, value, device.rssi);

      deviceContext = {
        setText: (text, textColor, backgroundColor) =>
          updateDeviceText(device, text, textColor, backgroundColor),
      };

      const {type, ...params} = JSON.parse(value);
      const beacon = createBeacon(type);
      beacon?.onAppear(params).forEach(action => action.run(deviceContext));

      device.onDisconnected(() => {
        console.log(`Disconnected ${device.id}`);
        const oldParams = JSON.parse(getDeviceValue(device));
        beacon
          ?.onDisappear(oldParams)
          ?.forEach(action => action.run(deviceContext));
      });

      const subscription = characteristic.monitor(
        async (error, characteristic) => {
          console.log(`Monitoring ${device.id}`);

          if (error) {
            console.log(`Error while monitoring ${device.id}`);
            deleteDevice(device);
            return;
          }

          const oldParams = JSON.parse(getDeviceValue(device));

          const value = base64.decode(characteristic.value);
          device = await device.readRSSI();
          updateDeviceData(device, value, device.rssi);
          console.log(`Updated characteristic for ${device.id}`);

          const newParams = JSON.parse(value);
          beacon
            ?.onChange(oldParams, newParams)
            ?.forEach(action => action.run(deviceContext));
        },
      );
      console.log(`Subscribed for ${device.id}`);
      updateDeviceSubscription(device, subscription);
    } catch (e) {
      console.log(`Error for ${device.id}, deleting`);
      console.log(e);
      deleteDevice(device);
    }
  };

  const asyncInit = async () => {
    await bleManager.startDeviceScan(
      [serviceUUID],
      {allowDuplicates: true},
      asyncHandleConnect,
    );
  };

  const asyncCleanup = async () => {
    // TODO: cancel all subscriptions
    await bleManager.stopDeviceScan();
  };

  React.useEffect(() => {
    asyncInit();
    return () => {
      asyncCleanup();
    };
  }, []);

  const nearestDevice = devices.sort((d1, d2) => d2.rssi - d1.rssi)?.[0];

  return (
    <View style={styles.containerStyle}>
      <View style={styles.nearestDeviceContainerStyle}>
        {nearestDevice && (
          <View
            style={{
              ...styles.nearestDeviceStyle,
              backgroundColor: nearestDevice.backgroundColor,
            }}>
            <Text
              style={{
                ...styles.nearestDeviceTextStyle,
                color: nearestDevice.textColor,
              }}>
              {nearestDevice.text}
            </Text>
          </View>
        )}
      </View>
      {/* <View style={styles.beaconsContainerStyle}>
        <ScrollView>
          {devices.map(d => (
            <TouchableOpacity key={d.device.id}>
              <View style={styles.beaconItemStyle}>
                <Text>Name: {d.device.name}</Text>
                <Text>ID: {d.device.id}</Text>
                <Text>Characteristic: {d.value}</Text>
                <Text>RSSI: {d.rssi}</Text>
                <Text>Text: {d.text}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View> */}
    </View>
  );
};

const styles = StyleSheet.create({
  containerStyle: {
    flexDirection: 'column',
    flex: 1,
  },
  nearestDeviceContainerStyle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eee',
  },
  beaconsContainerStyle: {
    flex: 1,
    backgroundColor: 'white',
  },
  beaconItemStyle: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'lightgray',
  },
  nearestDeviceStyle: {
    width: '100%',
    height: '100%',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'gray',
  },
  nearestDeviceTextStyle: {
    fontSize: 100,
    textAlign: 'center',
    fontWeight: 'bold',
  },
});

export default App;
