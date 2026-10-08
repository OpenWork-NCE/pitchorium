import { Global, Module } from '@nestjs/common';
import { TurnstileVerifier } from './turnstile-verifier';

/** Anti-spam check of the public routes of the api (Turnstile, ADR 0103). */
@Global()
@Module({ providers: [TurnstileVerifier], exports: [TurnstileVerifier] })
export class CaptchaModule {}
