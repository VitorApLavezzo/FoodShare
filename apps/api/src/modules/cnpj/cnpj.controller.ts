import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CnpjService } from './cnpj.service';
import { Public } from '../auth/decorators/public.decorator';
import { isValidCnpj } from '../../common/validators/is-cnpj.validator';

@ApiTags('cnpj')
@Controller('cnpj')
export class CnpjController {
  constructor(private readonly cnpjService: CnpjService) {}

  @Get(':document')
  @Public()
  @ApiOperation({
    summary:
      'Consulta dados públicos de uma empresa pelo CNPJ (Receita Federal via BrasilAPI), para autopreencher o cadastro. Nunca falha o cadastro manual: retorna found=false em caso de erro.',
  })
  async lookup(@Param('document') document: string) {
    const digits = document.replace(/\D/g, '');
    if (!isValidCnpj(digits)) {
      return { found: false };
    }
    return this.cnpjService.lookup(digits);
  }
}
