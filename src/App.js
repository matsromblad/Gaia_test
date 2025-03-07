import React from 'react';
import PredatorPreyRadialTree from './PredatorPreyRadialTree';

function App() {
  return (
    <div className="App">
      <header className="bg-blue-600 text-white p-4 mb-6">
        <h1 className="text-2xl font-bold">Wolf Prey Network Visualization</h1>
      </header>
      <main>
        <PredatorPreyRadialTree />
      </main>
      <footer className="mt-8 p-4 text-center text-gray-600">
        <p>Data sourced from Global Biotic Interactions (GloBI)</p>
      </footer>
    </div>
  );
}

export default App;
