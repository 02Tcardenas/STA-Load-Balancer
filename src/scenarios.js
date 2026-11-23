const cachePayloads = [
  "08319462", "74150328", "35908214", "60271395",
  "08319462", "95401837", "74150328", "21760842",
  "60271395", "48617509", "95401837", "81940256",
  "21760842", "53729601", "48617509", "81940256",
];

export const scenarios = [
  {
    name: "1) Servidores iguales",
    powers: [1, 1, 1, 1],
    arrivals: Array.from({ length: 16 }, (_, index) => [index * 0.25, 2]),
  },
  {
    name: "2) Servidores de distinta potencia",
    powers: [4, 3, 2, 1],
    arrivals: Array.from({ length: 16 }, (_, index) => [(index + 1) * 0.2, 4]),
  },
  {
    name: "3) Peticiones de distinto tamaño",
    powers: [2, 1, 1, 1],
    arrivals: [
      [0, 10],
      ...Array.from({ length: 15 }, (_, index) => [(index + 1) * 0.4, 2]),
    ],
  },
  {
    name: "4) Peticiones repetidas",
    powers: [1, 1, 1, 1],
    showCache: true,
    arrivals: cachePayloads.map((payload, index) => [index * 0.6, 2, payload]),
  },
];

export function requestsFor(scenario) {
  return scenario.arrivals.map(([time, work, payload], index) => ({
    time,
    request: Object.freeze({
      id: `P${String(index + 1).padStart(2, "0")}`,
      payload:
        payload ??
        String((index * 7489 + 8319462) % 100000000).padStart(8, "0"),
      work,
    }),
  }));
}
