import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateUserDto } from 'src/users/dto/create-user.dto';

export class RegisterDto {
  @ApiProperty({
    description: 'Nombre',
    example: 'Juan'
  })
  @IsNotEmpty()
  firstname: string;

  @ApiProperty({
    description: 'Apellido',
    example: 'Perez'
  })
  @IsNotEmpty()
  lastname: string;

  @ApiProperty({
    description: 'Debe ser un mail valido',
    example: 'prueba@mail.com',
    required: true
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description:
      'Su password debe contener 8 caracteres, un numero y una mayuscula',
    example: 'Prueba12',
    required: true
  })
  @IsNotEmpty({ message: 'El Password mo puede estar vacio' })
  @MinLength(8)
  password: string;
}
