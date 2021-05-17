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
  const [text, setText] = React.useState('Disconnected');
  const [disabled, setDisabled] = React.useState(false);
  const [devices, setDevices] = React.useState({});

  const handleConnectPress = async () => {
    console.log('Scan in progress...');
    setText('Scan in progress...');
    setDisabled(true);

    // start device scan when app is resumed
    await bleManager.startDeviceScan(
      [serviceUUID],
      {
        allowDuplicates: true,
      },
      async (error, device) => {
        if (error) {
          // TODO: handle Bluetooth adapter or Location off
          console.log(JSON.stringify(error));
          setText('Scan error');
          setDisabled(false);
          return;
        }

        if (devices[device.id]) {
          return;
        }

        console.log('Scanned device: ' + device.name);
        devices[device.id] = device;
        setDevices(devices);
        // setDevices is only to ensure that no other scan will connect to device in the same time

        try {
          await bleManager.connectToDevice(device.id);
        } catch (e) {
          devices[device.id] = null;
          setDevices(devices);
        }

        await device.discoverAllServicesAndCharacteristics();
        const characteristic = await device.readCharacteristicForService(
          serviceUUID,
          characteristicUUID,
        );

        setText(base64.decode(characteristic.value));

        const subscription = characteristic.monitor(
          async (error, characteristic) => {
            if (!error) {
              setText(base64.decode(characteristic.value));
            } else {
              setText('Disconnected');
              console.log('Device disconnected');
              try {
                await devices[device.id].cancelConnection();
              } catch (e) {}
              devices[device.id] = null;
              setDevices(devices);
            }
          },
        );

        console.log('Device connected');
        setDisabled(false);
      },
    );
  };

  const handleDisconnectPress = async () => {
    await bleManager.stopDeviceScan();
  };

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
      <Button
        title="Click me to start scanning!"
        onPress={handleConnectPress}
        disabled={disabled}
      />
      <Button
        title="Click me to stop scanning!"
        onPress={handleDisconnectPress}
        disabled={disabled}
      />
      <Button title="Say something!" onPress={handleSaySomething} />
      <Text>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  containerStyle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
});

export default App;
