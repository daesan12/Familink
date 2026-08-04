import {useEffect, useMemo, useState} from 'react';
import {
  Image,
  type ImageProps,
  type ImageSourcePropType,
  type ImageURISource,
} from 'react-native';

import {imageDiskCache, type ImageDiskCache} from './imageDiskCache';

interface CachedRemoteImageProps extends ImageProps {
  cache?: ImageDiskCache;
}

function remoteUri(source: ImageSourcePropType | undefined): string | null {
  if (
    source === undefined ||
    typeof source === 'number' ||
    Array.isArray(source) ||
    typeof source.uri !== 'string'
  ) {
    return null;
  }
  return /^https?:\/\//i.test(source.uri) ? source.uri : null;
}

export function CachedRemoteImage({
  cache = imageDiskCache,
  source,
  ...props
}: CachedRemoteImageProps) {
  const uri = useMemo(() => remoteUri(source), [source]);
  const [resolvedUri, setResolvedUri] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setResolvedUri(null);
    if (uri === null) {
      return () => {
        active = false;
      };
    }
    cache.resolve(uri).then(
      localUri => {
        if (active) {
          setResolvedUri(localUri);
        }
      },
      () => {
        if (active) {
          // 디스크 캐시 장애가 이미지 표시 장애로 번지지 않도록 원격 URL로 폴백한다.
          setResolvedUri(uri);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [cache, uri]);

  if (uri === null) {
    return <Image {...props} source={source} />;
  }
  return (
    <Image
      {...props}
      source={
        resolvedUri === null
          ? undefined
          : {...(source as ImageURISource), uri: resolvedUri}
      }
    />
  );
}
