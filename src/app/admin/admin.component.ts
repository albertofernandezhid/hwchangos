import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../state.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css'],
})
export class AdminComponent {
  private state = inject(StateService);

  password = '';
  loggedIn = false;
  showPasswordInput = false;
  error = '';

  private readonly ADMIN_PASSWORD = 'admin123';

  login() {
    if (this.password === this.ADMIN_PASSWORD) {
      this.loggedIn = true;
      this.showPasswordInput = false;
      this.error = '';
      this.password = '';
      this.state.setAdminMode(true);
    } else {
      this.error = 'Contraseña incorrecta';
    }
  }

  logout() {
    this.loggedIn = false;
    this.state.setAdminMode(false);
  }

  cancel() {
    this.showPasswordInput = false;
    this.password = '';
    this.error = '';
  }

  async changeTitle() {
    const newTitle = prompt('Nuevo título:');
    if (newTitle && newTitle.trim()) {
      await this.state.setTitle(newTitle.trim());
    }
  }

  async changeDescription() {
    const newDesc = prompt('Nueva descripción:');
    if (newDesc && newDesc.trim()) {
      await this.state.setDescription(newDesc.trim());
    }
  }

  resetAll() {
    if (confirm('¿Seguro que quieres resetear el sorteo completo?')) {
      this.state.resetAll();
    }
  }

  async markPaid() {
    const numbers = await firstValueFrom(this.state.numbers$);
    this.state.markSelectedAsPaid(numbers);
  }

  async unassign() {
    const numbers = await firstValueFrom(this.state.numbers$);
    this.state.unassignSelected(numbers);
  }
}
