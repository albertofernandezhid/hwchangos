import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';

import { TitleDescriptionComponent } from './title-description/title-description.component';
import { NumberGridComponent } from './number-grid/number-grid.component';
import { AdminComponent } from './admin/admin.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    TitleDescriptionComponent,
    NumberGridComponent,
    AdminComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  constructor(private firestore: Firestore) {}

  editarTituloYDescripcion() {
    console.log('Editar título y descripción activado');
  }

  resetearSorteo() {
    console.log('Resetear sorteo completo');
  }

  marcarNumerosPagados() {
    console.log('Marcar números como pagados');
  }

  desasignarNumeros() {
    console.log('Desasignar números');
  }
}
