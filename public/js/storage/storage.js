// Storage Manager - Handles localStorage persistence
export class StorageManager {
    constructor() {
        this.storageKey = 'pt-simulator-network';
        this.autoSaveInterval = null;
        this.autoSaveDelay = 30000; // 30 seconds
    }

    async loadNetwork() {
        try {
            // Priority to API if running on a server, fallback to local storage
            let data = null;
            if (window.location.protocol.startsWith('http')) {
                data = await this.loadFromAPI();
            }
            if (!data) {
                const localData = localStorage.getItem(this.storageKey);
                if (localData) {
                    data = JSON.parse(localData);
                }
            }
            return data;
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
            
            // localSave
            localStorage.setItem(this.storageKey, JSON.stringify(dataToSave));

            // Remote save if possible
            if (window.location.protocol.startsWith('http')) {
                this.saveToAPI(dataToSave).catch(e => console.warn('API Save unavailable', e));
            }

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
            document.dispatchEvent(new CustomEvent('pt-simulator:autosave'));
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

    async saveToAPI(data) {
        try {
            const response = await fetch('/api/save.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (e) {
            return null;
        }
    }

    async loadFromAPI() {
        try {
            const response = await fetch('/api/load.php');
            if (response.ok) {
                const list = await response.json();
                if (list.saves && list.saves.length > 0) {
                    const latest = list.saves[0].filename;
                    const res = await fetch('/api/load.php?file=' + latest);
                    return await res.json();
                }
            }
            return null;
        } catch (e) {
            return null;
        }
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