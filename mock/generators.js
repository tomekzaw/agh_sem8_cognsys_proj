module.exports = { traffic_lights, bus };

function* traffic_lights() {
  while (true) {
    for (let i = 9; i > 0; i--) {
      yield {
        type: "TRAFFIC_LIGHTS",
        color: "RED",
        seconds: i,
      };
    }
    for (let i = 7; i > 0; i--) {
      yield {
        type: "TRAFFIC_LIGHTS",
        color: "GREEN",
        seconds: i,
      };
    }
  }
}

function* bus() {
  while (true) {
    yield {
      type: "BUS",
      route: "139",
      direction: "Miasteczko Studenckie AGH",
    };
  }
}
