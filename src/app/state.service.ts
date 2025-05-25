import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { Firestore, collection, collectionData, doc, updateDoc, setDoc, getDoc } from '@angular/fire/firestore';
import { map } from 'rxjs/operators';

export interface NumberCell {
  id?: string;
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
  private readonly defaultCantidad = 100;
  private readonly defaultAdminPassword = 'admin123';

  private numerosCollection;
  numbers$: Observable<NumberCell[]>;

  private titleSource = new BehaviorSubject<string>(this.defaultTitle);
  title$ = this.titleSource.asObservable();

  private descriptionSource = new BehaviorSubject<string>(this.defaultDescription);
  description$ = this.descriptionSource.asObservable();

  private imageSource = new BehaviorSubject<string>('');
  image$ = this.imageSource.asObservable();

  private adminModeSource = new BehaviorSubject<boolean>(false);
  adminMode$ = this.adminModeSource.asObservable();

  private cantidadSource = new BehaviorSubject<number>(this.defaultCantidad);
  cantidad$ = this.cantidadSource.asObservable();

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

    this.initConfig();
    this.ensureNumerosCollectionExists();
  }

  private async initConfig() {
    try {
      const configDocRef = doc(this.firestore, 'config/general');
      const docSnap = await getDoc(configDocRef);

      if (!docSnap.exists()) {
        // Documento no existe, lo creamos con valores por defecto
        await setDoc(configDocRef, {
          title: this.defaultTitle,
          description: this.defaultDescription,
          cantidad: this.defaultCantidad,
          imageUrl: '',
          adminPassword: this.defaultAdminPassword
        });
        this.titleSource.next(this.defaultTitle);
        this.descriptionSource.next(this.defaultDescription);
        this.cantidadSource.next(this.defaultCantidad);
        this.imageSource.next('');
      } else {
        // Documento existe, actualizamos valores
        const data = docSnap.data() as {
          title?: string;
          description?: string;
          cantidad?: number;
          imageUrl?: string;
          adminPassword?: string;
        };

        this.titleSource.next(data.title ?? this.defaultTitle);
        this.descriptionSource.next(data.description ?? this.defaultDescription);
        this.imageSource.next(data.imageUrl ?? '');

        const cantidad = Math.max(10, Math.min(100, data.cantidad ?? this.defaultCantidad));
        this.cantidadSource.next(cantidad);

        // Si falta adminPassword, lo agregamos
        if (!data.adminPassword) {
          await setDoc(configDocRef, { adminPassword: this.defaultAdminPassword }, { merge: true });
        }
      }
    } catch (error) {
      console.error('Error en initConfig:', error);
      this.titleSource.next(this.defaultTitle);
      this.descriptionSource.next(this.defaultDescription);
      this.cantidadSource.next(this.defaultCantidad);
      this.imageSource.next('');
    }
  }

  private async ensureNumerosCollectionExists() {
    try {
      const currentNumbers = await firstValueFrom(this.numbers$);
      if (currentNumbers && currentNumbers.length > 0) return;

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
    } catch (error) {
      console.error('Error en ensureNumerosCollectionExists:', error);
    }
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
    try {
      await setDoc(configDoc, { title }, { merge: true });
    } catch (error) {
      console.error('Error en setTitle:', error);
    }
  }

  async setDescription(desc: string) {
    this.descriptionSource.next(desc);
    const configDoc = doc(this.firestore, 'config/general');
    try {
      await setDoc(configDoc, { description: desc }, { merge: true });
    } catch (error) {
      console.error('Error en setDescription:', error);
    }
  }

  async setImageUrl(url: string) {
    this.imageSource.next(url);
    const configDoc = doc(this.firestore, 'config/general');
    try {
      await setDoc(configDoc, { imageUrl: url }, { merge: true });
    } catch (error) {
      console.error('Error en setImageUrl:', error);
    }
  }

  async deleteImageUrl() {
    this.imageSource.next('');
    const configDoc = doc(this.firestore, 'config/general');
    try {
      await setDoc(configDoc, { imageUrl: '' }, { merge: true });
    } catch (error) {
      console.error('Error en deleteImageUrl:', error);
    }
  }

  async resetAll() {
    await this.setTitle(this.defaultTitle);
    await this.setDescription(this.defaultDescription);
    await this.deleteImageUrl();

    try {
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
    } catch (error) {
      console.error('Error en resetAll:', error);
    }
  }

  async updateNumber(id: string, data: Partial<NumberCell>) {
    try {
      const numberDoc = doc(this.firestore, `numeros/${id}`);
      await updateDoc(numberDoc, data);
    } catch (error) {
      console.error(`Error en updateNumber para id=${id}:`, error);
    }
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

  async setCantidad(valor: number) {
    const cantidad = Math.max(10, Math.min(100, valor));
    this.cantidadSource.next(cantidad);
    const configDoc = doc(this.firestore, 'config/general');
    try {
      await setDoc(configDoc, { cantidad }, { merge: true });
    } catch (error) {
      console.error('Error en setCantidad:', error);
    }
  }

  // ✅ Nuevo método para obtener la contraseña del admin desde Firestore
  async getAdminPassword(): Promise<string> {
    const configDoc = doc(this.firestore, 'config/general');
    try {
      const snapshot = await getDoc(configDoc);
      const data = snapshot.exists() ? snapshot.data() : {};
      return data['adminPassword'] ?? this.defaultAdminPassword;
    } catch (error) {
      console.error('Error al obtener la contraseña de administrador:', error);
      return this.defaultAdminPassword;
    }
  }
}