/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// Wait for the deviceready event before using any of Cordova's device APIs.
// Inicjalizacja po uruchomieniu aplikacji
document.addEventListener('deviceready', function () {
    var db = window.sqlitePlugin.openDatabase(
        { name: 'waypoints.db', location: 'default' },
        function () {
            console.log('Baza danych otwarta.');
        },
        function (error) {
            console.error('Błąd otwierania bazy danych:', error.message);
        }
    );

    const apiBaseUrl = 'http://192.168.1.10:3000/api/waypoints';

    // Funkcja synchronizująca lokalną bazę z serwerem
    function syncWithServer() {
        db.transaction(function (tx) {
            tx.executeSql('SELECT * FROM sync_status', [], function (tx, results) {
                if (results.rows.length === 0) {
                    // Pierwsza synchronizacja z serwerem
                    fetch(apiBaseUrl)
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`HTTP error! status: ${response.status}`);
                            }
                            return response.json();
                        })
                        .then(waypoints => {
                            db.transaction(function (tx) {
                                waypoints.forEach(waypoint => {
                                    tx.executeSql(
                                        `INSERT INTO waypoints (id, name, latitude, longitude, isVisited) VALUES (?, ?, ?, ?, ?)`,
                                        [waypoint.id, waypoint.name, waypoint.latitude, waypoint.longitude, waypoint.isVisited ? 1 : 0]
                                    );
                                });
    
                                // Oznacz synchronizację jako zakończoną
                                tx.executeSql('INSERT INTO sync_status (isSynchronized) VALUES (1)', []);
                            });
    
                            loadWaypoints(); // Odśwież dane na mapie i w liście
                        })
                        .catch(error => {
                            console.error('Błąd synchronizacji z serwerem:', error.message);
                            loadWaypoints(); // Wczytaj lokalne dane w przypadku braku połączenia
                        });
                } else {
                    console.log('Dane już zsynchronizowane. Ładowanie lokalnych danych.');
                    loadWaypoints();
                }
            });
        });
    }
    

    // Tworzenie tabeli
    db.transaction(function (tx) {
        tx.executeSql(
            `CREATE TABLE IF NOT EXISTS waypoints (
                id INTEGER PRIMARY KEY,
                name TEXT,
                latitude REAL,
                longitude REAL,
                isVisited INTEGER
            )`,
            [],
            function () {
                console.log('Tabela "waypoints" utworzona.');
                syncWithServer(); // Synchronizuj dane z serwerem
            }
        );

        db.transaction(function (tx) {
            tx.executeSql(
                `CREATE TABLE IF NOT EXISTS sync_status (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    isSynchronized INTEGER
                )`,
                [],
                function () {
                    console.log('Tabela "sync_status" utworzona.');
                }
            );
        });
        
    });

// Ładowanie waypointów i dodanie ich do mapy
function loadWaypoints() {
    db.transaction(function (tx) {
        tx.executeSql('SELECT * FROM waypoints', [], function (tx, results) {
            // Czyszczenie listy punktów
            const waypointsUl = document.getElementById('waypoints-ul');
            waypointsUl.innerHTML = '';

            // Zliczanie odwiedzonych miejsc
            let totalWaypoints = results.rows.length;
            let visitedCount = 0;

            // Usunięcie markerów punktów, ale zachowanie markera użytkownika
            map.eachLayer(function (layer) {
                if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
                    if (layer !== userMarker) {
                        map.removeLayer(layer);
                    }
                }
            });

            // Dodanie punktów do mapy i listy
            for (let i = 0; i < results.rows.length; i++) {
                let row = results.rows.item(i);

                // Sprawdzenie, czy punkt jest odwiedzony
                if (row.isVisited) {
                    visitedCount++;
                }

                // Dodanie markerów punktów na mapie
                L.marker([row.latitude, row.longitude])
                    .addTo(map)
                    .bindPopup(
                        `${row.name} - Odwiedzono: ${row.isVisited ? 'Tak' : 'Nie'}`
                    );

                // Dodanie punktów do listy
                const li = document.createElement('li');
                li.textContent = `${row.name} (${row.latitude.toFixed(5)}, ${row.longitude.toFixed(5)})`;
                li.className = row.isVisited ? 'visited' : '';

                // Przycisk nawigacji
                const navigateButton = document.createElement('button');
                navigateButton.textContent = 'Nawiguj';
                navigateButton.style.marginLeft = '10px';
                navigateButton.onclick = function () {
                    openNavigation(row.latitude, row.longitude);
                };

                li.appendChild(navigateButton);
                waypointsUl.appendChild(li);
            }

            // Wyświetlenie licznika odwiedzonych miejsc
            const counterDiv = document.getElementById('visited-counter');
            if (counterDiv) {
                counterDiv.textContent = `Odwiedziłeś ${visitedCount} z ${totalWaypoints} miejsc.`;
            } else {
                console.error('Brak elementu #visited-counter w HTML.');
            }
        });
    });
}

function resetVisitedStatus() {
    db.transaction(function (tx) {
        tx.executeSql(
            'UPDATE waypoints SET isVisited = 0',
            [],
            function () {
                console.log('Wszystkie punkty zresetowane.');
                loadWaypoints(); // Odśwież listę i licznik
            },
            function (tx, error) {
                console.error('Błąd przy resetowaniu waypointów:', error.message);
            }
        );
    });
}

// Przypisanie obsługi zdarzenia do przycisku resetowania
document.getElementById('reset-button').addEventListener('click', function () {
    if (confirm('Czy na pewno chcesz zresetować licznik odwiedzonych miejsc?')) {
        resetVisitedStatus();
    }
});
    

    // Inicjalizacja mapy
    var map = L.map('map').setView([49.8879, 18.8086], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    // Funkcja otwierająca aplikację do nawigacji
    function openNavigation(lat, lng) {
        const destination = `${lat},${lng}`;
        const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
        window.open(url, '_system'); // Otwiera link w domyślnej przeglądarce lub aplikacji
    }

    // Funkcja do obliczania odległości
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Promień Ziemi w metrach
        const φ1 = lat1 * (Math.PI / 180);
        const φ2 = lat2 * (Math.PI / 180);
        const Δφ = (lat2 - lat1) * (Math.PI / 180);
        const Δλ = (lon2 - lon1) * (Math.PI / 180);

        const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Odległość w metrach
    }

    // Dodanie geolokatora
    let userMarker;
    navigator.geolocation.watchPosition(
        function (position) {
            let lat = position.coords.latitude;
            let lng = position.coords.longitude;

            // Dodanie lub aktualizacja markera użytkownika
            if (userMarker) {
                userMarker.setLatLng([lat, lng]);
            } else {
                userMarker = L.circleMarker([lat, lng], {
                    color: 'blue',
                    radius: 10,
                }).addTo(map);
            }

            // Sprawdzanie odległości od waypointów
            db.transaction(function (tx) {
                tx.executeSql(
                    'SELECT * FROM waypoints WHERE isVisited = 0',
                    [],
                    function (tx, results) {
                        for (let i = 0; i < results.rows.length; i++) {
                            let row = results.rows.item(i);
                            let distance = calculateDistance(
                                lat,
                                lng,
                                row.latitude,
                                row.longitude
                            );

                            if (distance < 50) {
                                tx.executeSql(
                                    'UPDATE waypoints SET isVisited = 1 WHERE id = ?',
                                    [row.id],
                                    function () {
                                        console.log(`Odwiedzono punkt: ${row.name}`);
                                        loadWaypoints(); // Odświeżenie listy
                                    }
                                );
                            }
                        }
                    }
                );
            });
        },
        function (error) {
            console.error('Błąd geolokacji:', error.message);
        },
        { enableHighAccuracy: true }
    );
});