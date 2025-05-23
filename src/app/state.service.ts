import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { Firestore, collection, collectionData, doc, updateDoc, setDoc, getDoc } from '@angular/fire/firestore';
import { map } from 'rxjs/operators';

export interface NumberCell {
  id?: string;         // id del documento Firestore
  number: string;
  assignedTo?: string;
  selected?: boolean;
  blocked?: boolean;
  paid?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class StateService {
  private readonly defaultTitle = 'Título por defecto';
  private readonly defaultDescription = 'Descripción por defecto';

  private numerosCollection;

  numbers$: Observable<NumberCell[]>;

  private titleSource = new BehaviorSubject<string>(this.defaultTitle);
  title$ = this.titleSource.asObservable();

  private descriptionSource = new BehaviorSubject<string>(this.defaultDescription);
  description$ = this.descriptionSource.asObservable();

  private adminModeSource = new BehaviorSubject<boolean>(false);
  adminMode$ = this.adminModeSource.asObservable();

  constructor(private firestore: Firestore) {
    this.numerosCollection = collection(this.firestore, 'numeros');

    this.numbers$ = collectionData(this.numerosCollection, { idField: 'id' }).pipe(
      map(items =>
        items.map(item => ({
          id: item['id'],
          number: item['number'],
          assignedTo: item['assignedTo'] ?? '',
          selected: item['selected'] ?? false,
          blocked: item['blocked'] ?? false,
          paid: item['paid'] ?? false
        }))
      )
    );

    // Inicializar configuración: crear doc si no existe y cargar datos al BehaviorSubject
    this.initConfig();

    // Asegurar que la colección 'numeros' existe con documentos iniciales
    this.ensureNumerosCollectionExists();
  }

  private async initConfig() {
    const configDocRef = doc(this.firestore, 'config/general');
    const docSnap = await getDoc(configDocRef);

    if (!docSnap.exists()) {
      await setDoc(configDocRef, {
        title: this.defaultTitle,
        description: this.defaultDescription
      });
      console.log('Documento config/general creado con valores por defecto');
      this.titleSource.next(this.defaultTitle);
      this.descriptionSource.next(this.defaultDescription);
    } else {
      const data = docSnap.data() as { title?: string; description?: string };
      console.log('Documento config/general leído con datos:', data);
      this.titleSource.next(data.title ?? this.defaultTitle);
      this.descriptionSource.next(data.description ?? this.defaultDescription);
    }
  }

  private async ensureNumerosCollectionExists() {
    const currentNumbers = await firstValueFrom(this.numbers$);

    if (currentNumbers && currentNumbers.length > 0) {
      console.log('Colección numeros ya existe y tiene documentos');
      return;
    }

    console.log('Creando documentos en la colección numeros...');

    for (let i = 0; i <= 99; i++) {
      const id = i.toString().padStart(2, '0');
      const numberDocRef = doc(this.firestore, `numeros/${id}`);
      await setDoc(numberDocRef, {
        number: id,
        assignedTo: '',
        selected: false,
        blocked: false,
        paid: false
      });
    }

    console.log('Documentos numeros creados');
  }

  get isAdmin(): boolean {
    return this.adminModeSource.getValue();
  }

  setAdminMode(enabled: boolean) {
    this.adminModeSource.next(enabled);
  }

  async setTitle(title: string) {
    this.titleSource.next(title);
    const configDoc = doc(this.firestore, 'config/general');
    await setDoc(configDoc, { title }, { merge: true });
  }

  async setDescription(desc: string) {
    this.descriptionSource.next(desc);
    const configDoc = doc(this.firestore, 'config/general');
    await setDoc(configDoc, { description: desc }, { merge: true });
  }

  async resetAll() {
    await this.setTitle(this.defaultTitle);
    await this.setDescription(this.defaultDescription);

    const currentNumbers = await firstValueFrom(this.numbers$);
    if (!currentNumbers) return;

    for (const n of currentNumbers) {
      if (!n.id) continue;
      const numberDoc = doc(this.firestore, `numeros/${n.id}`);
      await updateDoc(numberDoc, {
        assignedTo: '',
        blocked: false,
        selected: false,
        paid: false
      });
    }
  }

  async updateNumber(id: string, data: Partial<NumberCell>) {
    const numberDoc = doc(this.firestore, `numeros/${id}`);
    await updateDoc(numberDoc, data);
  }

  async unassignSelected(numbers: NumberCell[]) {
    for (const n of numbers) {
      if (n.selected && n.blocked && n.id) {
        await this.updateNumber(n.id, {
          assignedTo: '',
          blocked: false,
          selected: false,
          paid: false
        });
      }
    }
  }

  async markSelectedAsPaid(numbers: NumberCell[]) {
    for (const n of numbers) {
      if (n.selected && n.blocked && n.id) {
        await this.updateNumber(n.id, {
          paid: true,
          selected: false
        });
      }
    }
  }

  async clearSelection(numbers: NumberCell[]) {
    for (const n of numbers) {
      if (n.selected && n.id) {
        await this.updateNumber(n.id, { selected: false });
      }
    }
  }
}
