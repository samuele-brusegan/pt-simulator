// Storage Manager - Handles localStorage persistence
export class StorageManager {
    constructor() {
        this.storageKey = 'pt-simulator-network';
        this.autoSaveInterval = null;
        this.autoSaveDelay = 30000; // 30 seconds
    }

    async loadNetwork() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                return JSON.parse(data);
            }
            return null;
        } catch (error) {
            console.error('Error loading network from storage:', error);
            return null;
        }
    }

    async saveNetwork(networkData) {
        try {
            const dataToSave = {
                ...networkData,
                version: networkData.version || '1.0',
                timestamp: networkData.timestamp || Date.now()
            };
            localStorage.setItem(this.storageKey, JSON.stringify(dataToSave));

            // Clear and restart auto-save timer
            this.clearAutoSave();
            this.startAutoSave();

            return true;
        } catch (error) {
            console.error('Error saving network to storage:', error);
            return false;
        }
    }

    startAutoSave() {
        if (this.autoSaveInterval) return;
        this.autoSaveInterval = setInterval(() => {
            // Trigger a save event - actual saving happens elsewhere
            document.dispatchEvent(new CustomService('pt-simulator:autosave'));
        }, this.autoSaveDelay);
    }

    clearAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }

    // Export/Import JSON functionality
    exportJSON(networkData) {
        const blob = new Blob([JSON.stringify(networkData, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pt-simulator-network-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    importJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    // Basic validation
                    if (data && typeof data === 'object') {
                        resolve(data);
                    } else {
                        reject(new Error('Invalid JSON format'));
                    }
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (e) => reject(e.error);
            reader.readAsText(file);
        });
    }
}