import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-esquema-compostera',
  templateUrl: './esquema-compostera.component.html',
  styleUrls: ['./esquema-compostera.component.scss'],
  standalone: false,
})
export class EsquemaComposteraComponent {
  // ==== Estados de actuadores (texto tipo 'ON', 'OFF', 'abierto', 'cerrado') ====
  @Input() motorEstado: string = 'OFF';

  // Leds amarillo/azul representan ventilador1/2
  @Input() vent1Estado: string = 'OFF';
  @Input() vent2Estado: string = 'OFF';

  // Led rojo representa la electroválvula
  @Input() electrovalEstado: string = 'OFF';

  // Servos (escotillas)
  @Input() servo1Estado: string = 'cerrado';
  @Input() servo2Estado: string = 'cerrado';

  // ==== Lecturas de sensores (pueden ser null) ====
  @Input() temp: number | null = null;
  @Input() humedad: number | null = null;
  @Input() nh3: number | null = null;
  @Input() ch4: number | null = null;

  // ==== Card “en foco” (click) ====
  focusedCard: 'motor' | 'valvula' | 'vent1' | 'vent2' | 'lecturas' | null =
    null;

  toggleFocus(
    card: 'motor' | 'valvula' | 'vent1' | 'vent2' | 'lecturas'
  ): void {
    this.focusedCard = this.focusedCard === card ? null : card;
  }

  // ---- Helpers de estado ----
  isOn(v: string | null | undefined): boolean {
    const s = String(v ?? '').trim().toLowerCase();
    return ['on', '1', 'true', 'encendido', 'activo'].includes(s);
  }

  isOpen(v: string | null | undefined): boolean {
    const s = String(v ?? '').trim().toLowerCase();
    if (['abierto', 'open'].includes(s)) return true;
    if (['cerrado', 'close'].includes(s)) return false;
    return this.isOn(s);
  }

  /**
   * Formatea lecturas numéricas.
   * @param v       valor
   * @param sufijo  unidad (ej: ' °C')
   * @param decimales número de decimales (default 0)
   */
  fmt(v: number | null, sufijo: string = '', decimales: number = 0): string {
    if (v == null || !isFinite(v)) return '---';
    return `${v.toFixed(decimales)}${sufijo}`;
  }
}
