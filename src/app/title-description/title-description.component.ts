import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../state.service';

@Component({
  selector: 'app-title-description',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './title-description.component.html',
  styleUrls: ['./title-description.component.css']
})
export class TitleDescriptionComponent {
  private state = inject(StateService);

  title$ = this.state.title$;
  description$ = this.state.description$;

  updateTitle() {
    const newTitle = prompt('Nuevo título:');
    if (newTitle && newTitle.trim() !== '') {
      this.state.setTitle(newTitle.trim());
    }
  }

  updateDescription() {
    const newDesc = prompt('Nueva descripción:');
    if (newDesc && newDesc.trim() !== '') {
      this.state.setDescription(newDesc.trim());
    }
  }
}
