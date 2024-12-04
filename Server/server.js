const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Tymczasowa baza danych waypointów
let waypoints = [
    { id: 1, name: "Punkt 1", latitude: 49.8828, longitude: 18.7976, isVisited: false },
    { id: 2, name: "Punkt 2", latitude: 49.9018, longitude: 18.7836, isVisited: false },
    { id: 3, name: "Punkt 3", latitude: 49.8764, longitude: 18.8261, isVisited: false },
    { id: 4, name: "DOM", latitude: 49.8879, longitude: 18.8086, isVisited: false }
];

// Endpoint: Pobranie listy waypointów
app.get('/api/waypoints', (req, res) => {
    res.json(waypoints);
});

// Endpoint: Pobranie szczegółów waypointa
app.get('/api/waypoints/:id', (req, res) => {
    const waypoint = waypoints.find(wp => wp.id === parseInt(req.params.id));
    if (waypoint) {
        res.json(waypoint);
    } else {
        res.status(404).json({ error: "Waypoint nie znaleziony" });
    }
});

// Endpoint: Oznaczenie waypointa jako odwiedzonego
app.put('/api/waypoints/:id/visit', (req, res) => {
    const waypoint = waypoints.find(wp => wp.id === parseInt(req.params.id));
    if (waypoint) {
        waypoint.isVisited = true;
        res.json({ message: "Waypoint oznaczony jako odwiedzony" });
    } else {
        res.status(404).json({ error: "Waypoint nie znaleziony" });
    }
});

// Endpoint: Resetowanie odwiedzin (dla testów)
app.put('/api/waypoints/reset', (req, res) => {
    waypoints.forEach(wp => (wp.isVisited = false));
    res.json({ message: "Wszystkie waypointy zresetowane" });
});

// Endpoint: Dodanie nowego waypointa
app.post('/api/waypoints', (req, res) => {
    const { name, latitude, longitude } = req.body;
    if (!name || latitude == null || longitude == null) {
        return res.status(400).json({ error: "Wszystkie pola są wymagane" });
    }

    const newWaypoint = {
        id: waypoints.length ? Math.max(...waypoints.map(wp => wp.id)) + 1 : 1,
        name,
        latitude,
        longitude,
        isVisited: false,
    };
    waypoints.push(newWaypoint);
    res.status(201).json(newWaypoint);
});

// Uruchomienie serwera
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
});