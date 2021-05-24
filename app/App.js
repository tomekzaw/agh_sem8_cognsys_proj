/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

import {Button, StyleSheet, Text, View} from 'react-native';

import {BleManager} from 'react-native-ble-plx';
import React from 'react';
import Tts from 'react-native-tts';
import base64 from 'react-native-base64';

const bleManager = new BleManager();
const serviceUUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const characteristicUUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

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

  const updateDeviceValue = (device, value) => {
    devicesRef.current[device.id] = {...devicesRef.current[device.id], value};
    updateUI();
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
    if (devicesRef) {
      subscription.remove();
    }
    (async () => {
      if (await device.isConnected()) {
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
      console.log(`Trying to connect to ${device.id}`);

      await bleManager.connectToDevice(device.id);
      console.log(`Connected to ${device.id}`);

      await device.discoverAllServicesAndCharacteristics();
      console.log(`Discovered ${device.id}`);

      const characteristic = await device.readCharacteristicForService(
        serviceUUID,
        characteristicUUID,
      );
      const value = base64.decode(characteristic.value);
      console.log(`Read characteristic for ${device.id}: ${value}`);
      updateDeviceValue(device, value);

      const subscription = characteristic.monitor(
        async (error, characteristic) => {
          console.log(`Monitoring ${device.id}`);

          if (error) {
            console.log(`Error while monitoring ${device.id}`);
            deleteDevice(device);
            return;
          }

          const value = base64.decode(characteristic.value);
          updateDeviceValue(device, value);
          console.log(`Updated characteristic for ${device.id}: ${value}`);
        },
      );
      console.log(`Subscribed for ${device.id}`);
      updateDeviceSubscription(device, subscription);
    } catch (e) {
      console.log(`Error for ${device.id}, deleting`);
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

  const handleSaySomething = async () => {
    Tts.getInitStatus().then(() => {
      // Tts.setDefaultLanguage('en-GB');
      Tts.speak('Linia 139. Kierunek: Miasteczko Studenckie AGH');
      Tts.speak('Drzwi otwarte. Proszę wsiadać.');
      Tts.speak('Światło czerwone. Pozostało 25 sekund.');
      Tts.speak('Światło zielone.');
    });
  };

  return (
    <View style={styles.containerStyle}>
      <View style={styles.beaconsContainerStyle}>
        {devices.map(d => (
          <View key={d.device.id} style={styles.beaconItemStyle}>
            <Text>Name: {d.device.name}</Text>
            <Text>ID: {d.device.id}</Text>
            <Text>Characteristic: {d.value}</Text>
          </View>
        ))}
      </View>
      <View style={styles.buttonsContainerStyle}>
        <Button title="Say something!" onPress={handleSaySomething} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  containerStyle: {
    flex: 1,
  },
  beaconsContainerStyle: {
    flex: 2,
    backgroundColor: '#fff',
  },
  beaconItemStyle: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'lightgray',
  },
  buttonsContainerStyle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eee',
  },
});

export default App;
