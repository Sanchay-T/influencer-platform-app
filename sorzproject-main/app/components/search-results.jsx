import React, { useEffect, useState } from 'react';

const SearchResults = () => {
  const [searchData, setSearchData] = useState({
    jobId: '',
    scraperLimit: '',
    keywords: ''
  });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('=== INICIO DE BÚSQUEDA ===');
    console.log('Datos iniciales:', {
      jobId: searchData.jobId,
      scraperLimit: searchData.scraperLimit,
      keywords: searchData.keywords
    });

    if (!searchData.jobId) {
      console.log('No hay jobId, iniciando búsqueda...');
      startSearch();
      return;
    }

    console.log('Iniciando polling con jobId:', searchData.jobId);
    pollResults();
  }, [searchData.jobId]);

  const pollResults = async () => {
    try {
      console.log('=== POLLING API ===');
      console.log('Consultando jobId:', searchData.jobId);
      
      const response = await fetch(`/api/scraping/tiktok?jobId=${searchData.jobId}`);
      const data = await response.json();
      
      console.log('Respuesta de API:', {
        status: data.status,
        totalRequested: data.totalRequested,
        totalReceived: data.totalReceived,
        resultsLength: data.results?.length
      });

      if (data.status === 'completed') {
        console.log('Búsqueda completada:', {
          totalRequested: data.totalRequested,
          totalReceived: data.totalReceived,
          resultsLength: data.results?.length
        });
        const allCreators = data.results?.reduce((acc, result) => {
          return [...acc, ...(result.creators || [])];
        }, []) || [];
        setResults(allCreators);
        setLoading(false);
      } else if (data.status === 'error') {
        console.error('Error en la búsqueda:', data.error);
        setError(data.error);
        setLoading(false);
      } else {
        console.log('Búsqueda en progreso:', data.status);
        setTimeout(pollResults, 30000);
      }
    } catch (error) {
      console.error('Error en polling:', error);
      setError('Error al obtener resultados');
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Render your component content here */}
    </div>
  );
};

export default SearchResults; 