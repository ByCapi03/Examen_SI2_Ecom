export const ComingSoon = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
      <h2 className="text-3xl font-bold text-primary mb-4">Próximamente</h2>
      <p className="text-gray-600 mb-8 max-w-md">
        Esta función está en desarrollo para el próximo ciclo. ¡Vuelve pronto!
      </p>
      <button 
        onClick={() => window.history.back()}
        className="btn-secondary"
      >
        Volver
      </button>
    </div>
  );
};
