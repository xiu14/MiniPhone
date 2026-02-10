/* Core: Router */
console.log('Router.js loading...');
import { renderMoments } from '../apps/moments.js'; // Dependency injection would be better, but strict imports needed

export function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');

    // trigger render if needed
    if (screenId === 'moments-screen') {
        // We need to ensure renderMoments is available. 
        // If circular dependency issues arise, we might move this trigger to main.js
        renderMoments();
    }
}

export function switchToCharHomeScreen() {
    document.querySelectorAll('.char-screen').forEach(s => s.classList.remove('active'));
    document.getElementById('char-home-screen').classList.add('active');
}

export function switchToMyPhone() {
    showScreen('home-screen');
}
