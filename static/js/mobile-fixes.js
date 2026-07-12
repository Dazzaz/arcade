// Archivo individual para ajustes móviles
document.addEventListener('DOMContentLoaded', () => {
    const backBtn = document.querySelector('.back-btn');
    
    // Función para verificar y ocultar el botón en móviles
    function checkMobileButton() {
        if (backBtn) {
            if (window.innerWidth < 768) {
                backBtn.classList.add('mobile-hidden');
            } else {
                backBtn.classList.remove('mobile-hidden');
            }
        }
    }
    
    // Ejecutar al cargar la página
    checkMobileButton();
    
    // Ejecutar al redimensionar la ventana
    window.addEventListener('resize', checkMobileButton);
});
