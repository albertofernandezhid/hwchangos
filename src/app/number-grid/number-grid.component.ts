import { Component, effect, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService, NumberCell } from '../state.service';
import { combineLatest, firstValueFrom, map, interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-number-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './number-grid.component.html',
  styleUrls: ['./number-grid.component.css']
})
export class NumberGridComponent implements OnDestroy {
  state = inject(StateService);
  private localSelections = new Set<string>(); // Selecciones locales
  private reservationTimer?: number;

  // Observable con los números, marcando seleccionados y tempBlocked
  numbers$ = combineLatest([
    this.state.numbers$,
    this.state.cantidad$
  ]).pipe(
    map(([numbers, cantidad]) => {
      const now = Date.now();
      return numbers.slice(0, cantidad).map(cell => ({
        ...cell,
        selected: this.localSelections.has(cell.id || ''),
        tempBlocked: cell.reservedBy && 
                    cell.reservedBy !== this.state.getSessionId() && 
                    (cell.reservedUntil || 0) > now
      }));
    })
  );

  adminMode$ = this.state.adminMode$;

  selectedUnblockedCount = signal(0);
  selectedUnblockedExist = signal(false);
  isAdmin = signal(false);

  // Contador de tiempo restante para cada celda, key = cell.id, value = string a mostrar
  countdowns: { [key: string]: string } = {};
  private countdownSubscription?: Subscription;

  constructor() {
    // Suscripción al modo admin
    this.adminMode$.subscribe((mode: boolean) => {
      this.isAdmin.set(mode);
    });

    // Limpiar reservas al cargar
    this.state.releaseAllUserReservations();

    // Configurar limpieza automática cada minuto
    this.reservationTimer = window.setInterval(() => {
      this.cleanupExpiredReservations();
    }, 60000);

    // Inicializar contadores
    this.updateSelectionCounts();

    // Suscripción para actualizar el tiempo restante cada segundo
    this.countdownSubscription = interval(1000).subscribe(() => {
      this.updateCountdowns();
    });
  }

  ngOnDestroy() {
    // Limpiar reservas al salir
    this.state.releaseAllUserReservations();
    
    if (this.reservationTimer) {
      clearInterval(this.reservationTimer);
    }

    if (this.countdownSubscription) {
      this.countdownSubscription.unsubscribe();
    }
  }

  async toggleSelect(cell: any) {
    if (cell.blocked || cell.tempBlocked) return;
    if (!this.isAdmin() && await this.hasMixedSelection(cell)) return;

    const cellId = cell.id || '';
    
    if (this.localSelections.has(cellId)) {
      // Deseleccionar: remover de selecciones locales y liberar reserva
      this.localSelections.delete(cellId);
      await this.state.releaseNumber(cellId);
    } else {
      // Seleccionar: intentar reservar primero
      const reserved = await this.state.reserveNumber(cellId);
      if (reserved) {
        this.localSelections.add(cellId);
      } else {
        alert('Este número está siendo considerado por otro usuario. Inténtalo de nuevo en unos minutos.');
      }
    }
    
    this.updateSelectionCounts();
  }

  async assignSelected() {
    if (this.localSelections.size === 0) return;

    const name = prompt('Introduce el nombre para asignar a los números seleccionados:');
    if (!name || name.trim() === '') {
      alert('Nombre inválido.');
      return;
    }

    const trimmed = name.trim();
    const selectedIds = Array.from(this.localSelections);

    // Verificar que todas las reservas siguen activas
    const current = await firstValueFrom(this.state.numbers$);
    const now = Date.now();
    const sessionId = this.state.getSessionId();
    
    for (const id of selectedIds) {
      const number = current.find(n => n.id === id);
      if (!number || 
          number.blocked || 
          (number.reservedBy !== sessionId) ||
          (number.reservedUntil || 0) <= now) {
        alert('Algunos números ya no están disponibles. Por favor, revisa tu selección.');
        // Limpiar selecciones locales y reservas
        this.localSelections.clear();
        await this.state.releaseAllUserReservations();
        this.updateSelectionCounts();
        return;
      }
    }

    // Asignar números
    for (const id of selectedIds) {
      await this.state.updateNumber(id, {
        assignedTo: trimmed,
        blocked: true,
        selected: false,
        reservedBy: null,
        reservedAt: null,
        reservedUntil: null
      });
    }

    // Limpiar selecciones locales
    this.localSelections.clear();
    this.updateSelectionCounts();
  }

  clearLocalSelection() {
    // Liberar todas las reservas del usuario
    this.state.releaseAllUserReservations();
    
    // Limpiar selecciones locales
    this.localSelections.clear();
    this.updateSelectionCounts();
  }

  getTitleForCell(cell: any): string {
    if (cell.blocked) {
      return `Asignado a ${cell.assignedTo}`;
    }
    if (cell.tempBlocked) {
      return 'Este número está siendo considerado por otro usuario';
    }
    if (cell.reservedBy === this.state.getSessionId()) {
      return `Número ${cell.number} - Reservado por ti`;
    }
    return `Número ${cell.number}`;
  }

  private updateSelectionCounts() {
    const count = this.localSelections.size;
    this.selectedUnblockedCount.set(count);
    this.selectedUnblockedExist.set(count > 0);
  }

  private async hasMixedSelection(newCell: any): Promise<boolean> {
    if (this.localSelections.size === 0) return false;
    
    const numbers = await firstValueFrom(this.state.numbers$);
    const selectedNumbers = numbers.filter(n => this.localSelections.has(n.id || ''));
    
    const hasBlocked = selectedNumbers.some(n => n.blocked);
    const hasUnblocked = selectedNumbers.some(n => !n.blocked);
    const newCellBlocked = newCell.blocked;
    
    return (hasBlocked && !newCellBlocked) || (hasUnblocked && newCellBlocked);
  }

  private async cleanupExpiredReservations() {
    const now = Date.now();
    const toRemove: string[] = [];
    
    try {
      const current = await firstValueFrom(this.state.numbers$);
      
      for (const cellId of this.localSelections) {
        const number = current.find(n => n.id === cellId);
        
        if (!number || 
            (number.reservedBy !== this.state.getSessionId()) ||
            (number.reservedUntil || 0) <= now) {
          toRemove.push(cellId);
        }
      }
      
      for (const id of toRemove) {
        this.localSelections.delete(id);
        await this.state.releaseNumber(id);
      }
      
      if (toRemove.length > 0) {
        this.updateSelectionCounts();
      }
    } catch (error) {
      console.error('Error en limpieza de reservas:', error);
    }
  }

  // --- NUEVO MÉTODO: actualizar los tiempos restantes para mostrar ---
  private updateCountdowns() {
    const now = Date.now();
    const sessionId = this.state.getSessionId();

    firstValueFrom(this.state.numbers$).then(numbers => {
      numbers.forEach(cell => {
        const isTempBlocked =
          cell.reservedBy &&
          cell.reservedBy !== sessionId &&
          (cell.reservedUntil || 0) > now;

        if (isTempBlocked && cell.reservedUntil) {
          const diff = cell.reservedUntil - now;
          if (diff > 0) {
            const minutes = Math.floor(diff / 1000 / 60);
            const seconds = Math.floor((diff / 1000) % 60);
            this.countdowns[cell.id || ''] = `${minutes}m ${seconds}s`;
          } else {
            this.countdowns[cell.id || ''] = 'Reserva expirada';
          }
        } else {
          this.countdowns[cell.id || ''] = '';
        }
      });
    });
  }
}