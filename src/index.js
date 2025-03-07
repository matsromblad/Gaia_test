import React from 'react';
import ReactDOM from 'react-dom';
import PredatorPreyRadialTree from './PredatorPreyRadialTree';

ReactDOM.render(
  <div className="container mx-auto px-4 py-8">
    <div className="bg-white shadow-lg rounded-lg p-6 mb-8">
      <h1 className="text-3xl mb-2">Predator-Prey Network Visualization</h1>
      <p className="subtitle text-lg mb-6">Explore biodiversity connections through our gaia.eco platform</p>
      <PredatorPreyRadialTree />
    </div>
    <div className="flex justify-center mt-4">
      <div className="text-sm text-medium-grey">
        Powered by Illuminum's algorithms and sustainable architecture tools
      </div>
    </div>
  </div>,
  document.getElementById('root')
);
