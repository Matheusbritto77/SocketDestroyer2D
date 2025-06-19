// Módulo Universe: universo infinito baseado na constante de Planck
const PLANCK_LENGTH = 1.616e-35; // metros (constante de Planck)

class Universe {
  constructor() {
    this.size = 1000; // tamanho inicial do universo (em unidades arbitrárias)
  }

  // Verifica se a posição está próxima da borda e expande o universo se necessário
  checkAndExpand(x, y) {
    const margin = 50; // margem para expandir
    let expanded = false;
    if (x > this.size - margin) {
      this.size += 500;
      expanded = true;
    }
    if (y > this.size - margin) {
      this.size += 500;
      expanded = true;
    }
    if (x < margin) {
      this.size += 500;
      expanded = true;
    }
    if (y < margin) {
      this.size += 500;
      expanded = true;
    }
    return expanded;
  }

  getSize() {
    return this.size;
  }
}

module.exports = new Universe();
