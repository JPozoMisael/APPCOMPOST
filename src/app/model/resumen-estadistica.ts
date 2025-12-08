export interface ResumenEstadisticas {
  temperaturaMax: number;
  temperaturaMin: number;
  temperaturaProm: number;
  humedadProm: number;
  nh3Max: number;
  ch4Max: number;
  activaciones: {
    ventilador: number;
    valvula: number;
    motor: number;
  };
}
