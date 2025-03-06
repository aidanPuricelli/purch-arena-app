import { HttpClient } from '@angular/common/http';
import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { AssetPathService } from '../services/asset-path.service';

@Component({
  selector: 'app-home-page',
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.css'
})
export class HomePageComponent implements OnInit, OnDestroy {
  showSettings = false;
  showSaveModal = false;
  savedStates: string[] = [];
  selectedSavedState: string = '';
  releaseNotes = false;
  releaseText = 'Release Notes';
  manaSymbols = ['W', 'U', 'B', 'R', 'G'];

  constructor(
    private http: HttpClient,
    private assetPathService: AssetPathService
  ) {}

  ngOnInit(): void {
    this.loadTheme();
    // Reset animation classes
    this.resetAnimations();
    console.log('Home page initialized');
  }

  ngOnDestroy(): void {
    // Clean up any subscriptions or listeners if needed
    this.showSettings = false;
    this.showSaveModal = false;
    this.releaseNotes = false;
  }

  private resetAnimations(): void {
    // Remove and re-add animation classes to ensure they play again
    const animatedElements = document.querySelectorAll('.animate__animated');
    animatedElements.forEach((element: Element) => {
      const htmlElement = element as HTMLElement;
      const classes = Array.from(htmlElement.classList)
        .filter(className => className.startsWith('animate__'));
      
      // Remove animation classes
      htmlElement.classList.remove(...classes);
      
      // Force reflow
      void htmlElement.offsetWidth;
      
      // Re-add animation classes
      htmlElement.classList.add(...classes);
    });
  }

  toggleSettings(): void {
    this.showSettings = !this.showSettings;
  }

  // Download Single JSON File
  downloadFile(fileName: string): void {
    const link = document.createElement('a');
    link.href = `/api/download/${fileName}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  downloadBoth(): void {
    this.downloadFile('decks.json');
    setTimeout(() => this.downloadFile('commander.json'), 500);
  }

  // Upload JSON File
  uploadFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const formData = new FormData();
    formData.append('file', file);

    this.http.post('/api/upload', formData).subscribe({
      next: () => alert(`${file.name} uploaded successfully!`),
      error: (err) => alert(`Error uploading file: ${err.error.message}`)
    });

    input.value = '';
  }

  // Hide settings if user clicks outside of dropdown
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const dropdown = document.querySelector('.settings-dropdown');
    const settingsIcon = document.querySelector('.settings-icon');

    if (
      this.showSettings &&
      dropdown &&
      !dropdown.contains(target) &&
      settingsIcon &&
      !settingsIcon.contains(target)
    ) {
      this.showSettings = false;
    }
  }

  // Open modal for managing saved games
  openSaveModal() {
    this.showSaveModal = true;
    this.fetchSavedStates();
  }

  closeSaveModal() {
    this.showSaveModal = false;
  }

  // Fetch saved states from server and remove .json extensions
  fetchSavedStates() {
    fetch('/api/saved-states')
      .then(response => response.json())
      .then(data => {
        if (data.savedStates) {
          // Remove .json extension from each state name
          this.savedStates = data.savedStates.map((state: string) => state.replace(/\.json$/, ''));
        }
      })
      .catch(error => {
        console.error('Error fetching saved states:', error);
        alert('Failed to retrieve saved states.');
      });
  }

  // Delete the selected game save
  deleteSelectedState() {
    if (!this.selectedSavedState) {
      alert('Please select a saved state to delete.');
      return;
    }

    const fileName = this.selectedSavedState;

    if (!confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`)) {
      return;
    }

    fetch(`/api/delete-game/${fileName}`, {
      method: 'DELETE'
    })
      .then(response => response.json())
      .then(data => {
        if (data.message) {
          alert(data.message);
          // Remove deleted state from savedStates array
          this.savedStates = this.savedStates.filter(state => state !== fileName);
          this.selectedSavedState = '';
        } else {
          alert('Failed to delete the selected save.');
        }
      })
      .catch(error => {
        console.error('Error deleting save:', error);
        alert('Failed to delete the selected save.');
      });
  }

  toggleReleaseNotes() {
    this.releaseNotes = !this.releaseNotes;
    if (this.releaseNotes) {
      this.releaseText = 'x';
    } else {
      this.releaseText = 'Release Notes';
    }
  }

  toggleTheme(event: any): void {
    const isDarkMode = event.target.checked;
    const theme = isDarkMode ? 'dark-theme' : 'light-theme';
    document.documentElement.className = theme;
    localStorage.setItem('theme', theme);
  }

  loadTheme(): void {
    const savedTheme = localStorage.getItem('theme') || 'light-theme';
    document.documentElement.className = savedTheme;
    const checkbox = document.querySelector('.switch input') as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = savedTheme === 'dark-theme';
    }
  }

  getManaSymbolPath(symbol: string): string {
    return this.assetPathService.getAssetPath(`symbols-png/${symbol}.png`);
  }

}
