import { Controller, Get } from '@nestjs/common';

@Controller() // vacío significa la ruta raíz "/"
export class AppController {
  @Get()
  getRoot(): string {
    return 'Bienvenidos a nuestra API';
  }
}
