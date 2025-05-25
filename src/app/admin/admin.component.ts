import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../state.service';
import { firstValueFrom } from 'rxjs';

import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { v4 as uuidv4 } from 'uuid';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css'],
})
export class AdminComponent implements OnInit {
  private state = inject(StateService);
  private storage = inject(Storage);

  password = '';
  loggedIn = false;
  showPasswordInput = false;
  error = '';

  cantidad = 100;
  imageFile: File | null = null;

  async ngOnInit() {
    this.cantidad = await firstValueFrom(this.state.cantidad$);
  }

  async login() {
    try {
      const storedPassword = await this.state.getAdminPassword();
      if (this.password === storedPassword) {
        this.loggedIn = true;
        this.showPasswordInput = false;
        this.error = '';
        this.password = '';
        this.state.setAdminMode(true);
      } else {
        this.error = 'Contraseña incorrecta';
      }
    } catch (err) {
      console.error('Error al obtener la contraseña:', err);
      this.error = 'No se pudo verificar la contraseña';
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

  onFileSelected(event: any) {
    this.imageFile = event.target.files[0];
  }

  async uploadImage() {
    if (!this.imageFile) {
      alert('Selecciona una imagen primero.');
      return;
    }

    const filePath = `imagenes/${uuidv4()}`;
    const storageRef = ref(this.storage, filePath);

    try {
      await uploadBytes(storageRef, this.imageFile);

      const downloadURL = await getDownloadURL(storageRef);
      await this.state.setImageUrl(downloadURL);

      alert('Imagen subida correctamente.');
      this.imageFile = null;
    } catch (error) {
      console.error('Error subiendo la imagen:', error);
      alert('Error al subir la imagen. Intenta nuevamente.');
    }
  }

  async resetAll() {
    if (confirm('¿Seguro que quieres resetear el sorteo completo?')) {
      try {
        await this.state.deleteImageUrl(); // Solo borra la URL en Firestore
      } catch (err) {
        console.warn('No se pudo eliminar la URL de la imagen:', err);
      }

      await this.state.resetAll();
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

  actualizarCantidad() {
    const valor = Math.max(10, Math.min(100, this.cantidad));
    this.cantidad = valor;
    this.state.setCantidad(valor);
  }
}
