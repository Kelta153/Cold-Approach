import { Global, Module } from '@nestjs/common';
import { BusinessLineContext } from './business-line-context';

/** Global so every feature module can inject `BusinessLineContext` without re-importing this
 * module everywhere. The provider itself is still request-scoped (see business-line-context.ts). */
@Global()
@Module({
  providers: [BusinessLineContext],
  exports: [BusinessLineContext],
})
export class BusinessLineScopeModule {}
