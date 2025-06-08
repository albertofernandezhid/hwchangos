import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  updateDoc,
  setDoc,
  getDoc,
  writeBatch
} from '@angular/fire/firestore';
import { map } from 'rxjs/operators';

export interface NumberCell {
  id?: string;
  number: string;
  assignedTo?: string;
  selected?: boolean;
  blocked?: boolean;
  paid?: boolean;
  reservedBy?: string | null;
  reservedAt?: number | null;
  reservedUntil?: number | null;
  tempBlocked?: boolean;
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

  // Generar ID único por sesión
  private sessionId = this.generateSessionId();

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
          paid: item['paid'] ?? false,
          reservedBy: item['reservedBy'] ?? null,
          reservedAt: item['reservedAt'] ?? null,
          reservedUntil: item['reservedUntil'] ?? null
        }))
      )
    );

    this.initConfig();
    this.ensureNumerosCollectionExists();
  }

  private generateSessionId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private async initConfig() {
    try {
      const configDocRef = doc(this.firestore, 'config/general');
      const docSnap = await getDoc(configDocRef);

      if (!docSnap.exists()) {
        await setDoc(configDocRef, {
          title: this.defaultTitle,
          description: this.defaultDescription,
          cantidad: this.defaultCantidad,
          imageUrl: '',
          adminPassword: this.defaultAdminPassword,
          masterPassword: 'superadmin' // Inicialización si no existe
        });
        this.titleSource.next(this.defaultTitle);
        this.descriptionSource.next(this.defaultDescription);
        this.cantidadSource.next(this.defaultCantidad);
        this.imageSource.next('');
      } else {
        const data = docSnap.data() as {
          title?: string;
          description?: string;
          cantidad?: number;
          imageUrl?: string;
          adminPassword?: string;
          masterPassword?: string;
        };

        this.titleSource.next(data.title ?? this.defaultTitle);
        this.descriptionSource.next(data.description ?? this.defaultDescription);
        this.imageSource.next(data.imageUrl ?? '');

        const cantidad = Math.max(10, Math.min(100, data.cantidad ?? this.defaultCantidad));
        this.cantidadSource.next(cantidad);

        if (!data.adminPassword) {
          await setDoc(configDocRef, { adminPassword: this.defaultAdminPassword }, { merge: true });
        }

        if (!data.masterPassword) {
          await setDoc(configDocRef, { masterPassword: 'superadmin' }, { merge: true });
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
          paid: false,
          reservedBy: null,
          reservedAt: null,
          reservedUntil: null
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

  getSessionId(): string {
    return this.sessionId;
  }

  async reserveNumber(id: string): Promise<boolean> {
    try {
      const now = Date.now();
      const reserveUntil = now + (5 * 60 * 1000); // 5 minutos de reserva

      // Verificar si el número ya está reservado por otro usuario
      const currentNumbers = await firstValueFrom(this.numbers$);
      const number = currentNumbers.find(n => n.id === id);
      
      if (number?.reservedBy && 
          number.reservedBy !== this.sessionId && 
          (number.reservedUntil || 0) > now) {
        return false; // Ya está reservado por otro usuario
      }

      await updateDoc(doc(this.firestore, `numeros/${id}`), {
        reservedBy: this.sessionId,
        reservedAt: now,
        reservedUntil: reserveUntil
      });
      
      return true;
    } catch (error) {
      console.error('Error al reservar número:', error);
      return false;
    }
  }

  async releaseNumber(id: string): Promise<void> {
    try {
      await updateDoc(doc(this.firestore, `numeros/${id}`), {
        reservedBy: null,
        reservedAt: null,
        reservedUntil: null
      });
    } catch (error) {
      console.error('Error al liberar número:', error);
    }
  }

  async releaseAllUserReservations(): Promise<void> {
    try {
      const currentNumbers = await firstValueFrom(this.numbers$);
      const userReserved = currentNumbers.filter(n => n.reservedBy === this.sessionId);
      
      for (const number of userReserved) {
        if (number.id) {
          await this.releaseNumber(number.id);
        }
      }
    } catch (error) {
      console.error('Error al liberar todas las reservas:', error);
    }
  }

  async setTitle(title: string) {
    this.titleSource.next(title);
    try {
      await setDoc(doc(this.firestore, 'config/general'), { title }, { merge: true });
    } catch (error) {
      console.error('Error en setTitle:', error);
    }
  }

  async setDescription(desc: string) {
    this.descriptionSource.next(desc);
    try {
      await setDoc(doc(this.firestore, 'config/general'), { description: desc }, { merge: true });
    } catch (error) {
      console.error('Error en setDescription:', error);
    }
  }

  async setImageUrl(url: string) {
    this.imageSource.next(url);
    try {
      await setDoc(doc(this.firestore, 'config/general'), { imageUrl: url }, { merge: true });
    } catch (error) {
      console.error('Error en setImageUrl:', error);
    }
  }

  async deleteImageUrl() {
    this.imageSource.next('');
    try {
      await setDoc(doc(this.firestore, 'config/general'), { imageUrl: '' }, { merge: true });
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
        await updateDoc(doc(this.firestore, `numeros/${n.id}`), {
          assignedTo: '',
          blocked: false,
          selected: false,
          paid: false,
          reservedBy: null,
          reservedAt: null,
          reservedUntil: null
        });
      }
    } catch (error) {
      console.error('Error en resetAll:', error);
    }
  }

  async updateNumber(id: string, data: Partial<NumberCell>) {
    try {
      await updateDoc(doc(this.firestore, `numeros/${id}`), data);
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
          paid: false,
          reservedBy: null,
          reservedAt: null,
          reservedUntil: null
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
    const batch = writeBatch(this.firestore);
    numbers
      .filter(n => n.selected)
      .forEach(n => {
      const docRef = doc(this.numerosCollection, n.id);
        batch.update(docRef, { selected: false });
      });
    await batch.commit();
  }


  async setCantidad(valor: number) {
    const cantidad = Math.max(10, Math.min(100, valor));
    this.cantidadSource.next(cantidad);
    try {
      await setDoc(doc(this.firestore, 'config/general'), { cantidad }, { merge: true });
    } catch (error) {
      console.error('Error en setCantidad:', error);
    }
  }

  async getAdminPassword(): Promise<string> {
    try {
      const snapshot = await getDoc(doc(this.firestore, 'config/general'));
      const data = snapshot.exists() ? snapshot.data() : {};
      return data['adminPassword'] ?? this.defaultAdminPassword;
    } catch (error) {
      console.error('Error al obtener la contraseña de administrador:', error);
      return this.defaultAdminPassword;
    }
  }

  async validateMasterPassword(masterPass: string): Promise<boolean> {
    try {
      const snapshot = await getDoc(doc(this.firestore, 'config/general'));
      const data = snapshot.exists() ? snapshot.data() : {};
      const storedMasterPassword = data['masterPassword'];
      return storedMasterPassword && masterPass === storedMasterPassword;
    } catch (error) {
      console.error('Error al validar contraseña maestra:', error);
      return false;
    }
  }

  async setAdminPassword(newPassword: string): Promise<void> {
    try {
      await setDoc(doc(this.firestore, 'config/general'), { adminPassword: newPassword }, { merge: true });
    } catch (error) {
      console.error('Error al establecer nueva contraseña de administrador:', error);
    }
  }
}