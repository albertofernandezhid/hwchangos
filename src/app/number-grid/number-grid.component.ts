import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService, NumberCell } from '../state.service';
import { combineLatest, firstValueFrom, map } from 'rxjs';

@Component({
  selector: 'app-number-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './number-grid.component.html',
  styleUrls: ['./number-grid.component.css']
})
export class NumberGridComponent {
  private state = inject(StateService);

  // Limita el número de casillas mostradas según la configuración del admin
  numbers$ = combineLatest([
    this.state.numbers$,
    this.state.cantidad$
  ]).pipe(
    map(([numbers, cantidad]) => numbers.slice(0, cantidad))
  );

  adminMode$ = this.state.adminMode$;

  selectedUnblockedCount = signal(0);
  selectedUnblockedExist = signal(false);
  isAdmin = signal(false);

  constructor() {
    // Suscripciones directas para actualizar signals
    this.numbers$.subscribe((numbers: NumberCell[]) => {
      const selectedUnblocked = numbers.filter(n => n.selected && !n.blocked);
      this.selectedUnblockedCount.set(selectedUnblocked.length);
      this.selectedUnblockedExist.set(selectedUnblocked.length > 0);
    });

    this.adminMode$.subscribe((mode: boolean) => {
      this.isAdmin.set(mode);
    });
  }

  async toggleSelect(cell: NumberCell) {
    if (cell.blocked && !this.isAdmin()) return;

    // Obtener snapshot actual de números
    const numbers = await firstValueFrom(this.state.numbers$); // NOTA: usamos el stream completo aquí
    const selected = numbers.filter(n => n.selected);
    const isMixed = selected.length > 0 &&
      selected.some(n => n.blocked !== cell.blocked);

    if (!this.isAdmin() && isMixed) return;

    // Cambiar selección solo del número dado
    const updatedSelected = !cell.selected;

    // Actualizar Firestore con updateNumber para el número toggled
    if (cell.id) {
      await this.state.updateNumber(cell.id, { selected: updatedSelected });
    }
  }

  async assignSelected() {
    const current = await firstValueFrom(this.state.numbers$); // usamos todos, no solo los visibles
    const selected = current.filter(c => c.selected && !c.blocked);
    if (selected.length === 0) return;

    const name = prompt('Introduce el nombre para asignar a los números seleccionados:');
    if (!name || name.trim() === '') {
      alert('Nombre inválido.');
      return;
    }
    const trimmed = name.trim();

    // Para cada seleccionado actualizar firestore
    for (const c of selected) {
      if (c.id) {
        await this.state.updateNumber(c.id, {
          assignedTo: trimmed,
          blocked: true,
          selected: false
        });
      }
    }
  }
}
