import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @MinLength(2)
  name: string;
}

export class AddMemberDto {
  @IsEmail()
  email: string;
}
