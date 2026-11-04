import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CarDto } from '../../models/api.models';
import { CarService } from '../../../core/services/car.service';
import { NotificationService } from '../../../core/services/notification.service';
import { IconComponent } from '../icon/icon.component';
import { WheelSpinnerComponent } from '../wheel-spinner/wheel-spinner.component';

@Component({
  selector: 'app-odometer-modal',
  standalone: true,
  imports: [WheelSpinnerComponent, IconComponent, CommonModule, FormsModule],
  template: `
    <div
      *ngIf="isOpen"
      class="fixed inset-0 z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        (click)="close()"
      ></div>

      <!-- Dialog -->
      <div
        class="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 z-10 overflow-hidden animate-in zoom-in-95 duration-200"
        (click)="$event.stopPropagation()"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700/80 bg-gray-50/70 dark:bg-gray-800/90">
          <div class="flex items-center space-x-3">
            <div class="flex items-center justify-center w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
              <app-icon name="odometer" class="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1"></app-icon>
            </div>
            <div>
              <h3 class="text-base font-bold text-gray-900 dark:text-white">Quick Odometer Update</h3>
            </div>
          </div>

          <button
            type="button"
            (click)="close()"
            [disabled]="isUpdating"
            class="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors focus:outline-none disabled:opacity-50"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <form (ngSubmit)="submitUpdate()" class="p-6 space-y-4">
          <!-- Error Alert -->
          <div
            *ngIf="errorMessage"
            class="p-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 flex items-start space-x-2.5 text-red-700 dark:text-red-300 text-xs"
          >
            <svg class="w-4 h-4 shrink-0 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{{ errorMessage }}</span>
          </div>

          <!-- Select Vehicle -->
          <div>
            <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Select Vehicle
            </label>
            <select
              [(ngModel)]="selectedCarId"
              (change)="onCarChange()"
              name="carId"
              [disabled]="isUpdating"
              class="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
            >
              <option *ngFor="let car of carsList" [value]="car.id">
                {{ car.brand }} {{ car.model }} ({{ car.plateNumber || 'No Plate' }}) — Current: {{ car.currentKm | number }} KM
              </option>
            </select>
          </div>

          <!-- Current Recorded Odometer -->
          <div class="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-900/30 border border-purple-100 dark:border-purple-900/40 flex items-center justify-between text-xs">
            <span class="text-purple-700 dark:text-purple-300 font-medium">Recorded Odometer</span>
            <span class="font-bold text-purple-900 dark:text-purple-200">{{ currentKm | number }} KM</span>
          </div>

          <!-- New Odometer Input -->
          <div>
            <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              New Odometer Mileage (KM)
            </label>
            <input
              type="number"
              [(ngModel)]="newKm"
              name="newKm"
              [disabled]="isUpdating"
              placeholder="e.g. 65000"
              min="0"
              required
              class="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
            />
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              (click)="close()"
              [disabled]="isUpdating"
              class="px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              [disabled]="isUpdating || newKm === null || newKm === undefined || newKm < 0"
              class="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 rounded-xl transition-all shadow-sm focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <app-wheel-spinner *ngIf="isUpdating" class="-ml-1 mr-2 h-4 w-4 text-white"></app-wheel-spinner>
              <span>{{ isUpdating ? 'Updating...' : 'Update & Recalculate' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class OdometerModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() carsList: CarDto[] = [];
  @Input() preselectCarId?: number;
  @Output() closed = new EventEmitter<void>();
  @Output() updated = new EventEmitter<{ carId: number; newKm: number }>();

  selectedCarId?: number;
  currentKm = 0;
  newKm: number | null = null;
  isUpdating = false;
  errorMessage = '';

  constructor(
    private carService: CarService,
    private notificationService: NotificationService
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isOpen'] && this.isOpen) {
      this.initModalValues();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.isOpen && !this.isUpdating) {
      this.close();
    }
  }

  private initModalValues() {
    if (this.carsList.length === 0) return;

    if (this.preselectCarId && this.carsList.some((c) => c.id === Number(this.preselectCarId))) {
      this.selectedCarId = Number(this.preselectCarId);
    } else if (!this.selectedCarId || !this.carsList.some((c) => c.id === Number(this.selectedCarId))) {
      this.selectedCarId = this.carsList[0].id;
    }

    this.onCarChange();
    this.newKm = null;
    this.errorMessage = '';
  }

  onCarChange() {
    const car = this.carsList.find((c) => c.id === Number(this.selectedCarId));
    if (car) {
      this.currentKm = car.currentKm || 0;
    }
  }

  submitUpdate() {
    if (!this.selectedCarId) {
      this.errorMessage = 'Please select a vehicle.';
      return;
    }

    if (this.newKm === null || this.newKm === undefined || this.newKm < 0) {
      this.errorMessage = 'Please enter a valid non-negative mileage.';
      return;
    }

    const carId = Number(this.selectedCarId);
    const newKm = Number(this.newKm);
    const selectedCar = this.carsList.find((c) => c.id === carId);

    this.isUpdating = true;
    this.errorMessage = '';

    this.carService.updateOdometer(carId, newKm).subscribe({
      next: (updatedCar) => {
        this.isUpdating = false;
        const carName = selectedCar ? `${selectedCar.brand} ${selectedCar.model}` : `Car #${carId}`;
        this.notificationService.showSuccess(
          `Odometer for ${carName} updated to ${updatedCar.currentKm.toLocaleString()} KM. Maintenance schedule recalculated!`,
          5000
        );
        this.updated.emit({ carId, newKm });
        this.close();
      },
      error: (err) => {
        this.isUpdating = false;
        this.errorMessage = err?.error?.message || 'Failed to update odometer. Please try again.';
      }
    });
  }

  close() {
    if (this.isUpdating) return;
    this.isOpen = false;
    this.errorMessage = '';
    this.newKm = null;
    this.closed.emit();
  }
}
