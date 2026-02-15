import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet, Alert, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from './src/styles/tokens';

interface ImageItem {
  id: string;
  originalFile: File;
  originalUrl: string;
  convertedUrl: string | null;
  status: 'pending' | 'converting' | 'done';
}

export default function App() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [targetWidth, setTargetWidth] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const pickImages = () => {
    if (!fileInputRef.current) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.style.display = 'none';
      document.body.appendChild(input);
      fileInputRef.current = input;
    }

    fileInputRef.current.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const files = target.files;
      if (!files || files.length === 0) return;

      const newImages: ImageItem[] = Array.from(files).map(file => ({
        id: Math.random().toString(),
        originalFile: file,
        originalUrl: URL.createObjectURL(file),
        convertedUrl: null,
        status: 'pending',
      }));

      setImages(prev => [...prev, ...newImages]);
    };

    fileInputRef.current.click();
  };

  const convertImage = async (id: string) => {
    const image = images.find(img => img.id === id);
    if (!image) return;

    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, status: 'converting' } : img
    ));

    try {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = image.originalUrl;
      });

      let canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context failed');

      const width = parseInt(targetWidth);
      if (!isNaN(width) && width > 0) {
        const aspectRatio = img.height / img.width;
        const height = Math.round(width * aspectRatio);
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
      }

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Blob creation failed'));
          },
          'image/webp',
          0.8
        );
      });

      if (image.convertedUrl) {
        URL.revokeObjectURL(image.convertedUrl);
      }

      const convertedUrl = URL.createObjectURL(blob);

      setImages(prev => prev.map(img =>
        img.id === id ? { ...img, convertedUrl, status: 'done' } : img
      ));
    } catch (error) {
      Alert.alert('Error', 'Conversion failed');
      setImages(prev => prev.map(img =>
        img.id === id ? { ...img, status: image.convertedUrl ? 'done' : 'pending' } : img
      ));
    }
  };

  const convertAll = async () => {
    const pending = images.filter(img => img.status === 'pending');
    for (const img of pending) {
      await convertImage(img.id);
    }
  };

  const downloadAll = () => {
    const converted = images.filter(img => img.convertedUrl);
    if (converted.length === 0) return;

    try {
      converted.forEach(img => {
        const a = document.createElement('a');
        a.href = img.convertedUrl!;
        a.download = `converted-${img.id}.webp`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
    } catch (error) {
      Alert.alert('Error', 'Download all failed');
    }
  };

  const removeImage = (id: string) => {
    const imageToRemove = images.find(img => img.id === id);
    if (imageToRemove) {
      URL.revokeObjectURL(imageToRemove.originalUrl);
      if (imageToRemove.convertedUrl) {
        URL.revokeObjectURL(imageToRemove.convertedUrl);
      }
    }
    
    const newImages = images.filter(img => img.id !== id);
    setImages(newImages);
    
    if (selectedId === id) {
      if (newImages.length > 0) {
        const removedIndex = images.findIndex(img => img.id === id);
        const nextImage = newImages[removedIndex] || newImages[0];
        setSelectedId(nextImage.id);
      } else {
        setSelectedId(null);
      }
    }
  };

  const pendingCount = images.filter(img => img.status === 'pending').length;
  const convertedCount = images.filter(img => img.convertedUrl).length;

  return (
    <View style={styles.container}>
      <View style={styles.uploadRow}>
        <TouchableOpacity style={styles.button} onPress={pickImages}>
          <Text style={styles.buttonText} numberOfLines={1}>+ Add</Text>
        </TouchableOpacity>
        {images.length > 0 && pendingCount > 0 && (
          <TouchableOpacity 
            style={[styles.button, styles.convertAllButton]} 
            onPress={convertAll}
          >
            <Text style={styles.buttonText} numberOfLines={1}>
              {targetWidth ? 'Resize All' : 'Convert All'}
            </Text>
          </TouchableOpacity>
        )}
        {convertedCount > 0 && (
          <TouchableOpacity 
            style={[styles.button, styles.downloadAllButton]} 
            onPress={downloadAll}
          >
            <Text style={styles.buttonText} numberOfLines={1}>Download All</Text>
          </TouchableOpacity>
        )}
      </View>

      {images.length > 0 && (
        <ScrollView 
          horizontal 
          style={styles.queueScroll}
          showsHorizontalScrollIndicator={false}
        >
          {images.map(img => (
            <TouchableOpacity
              key={img.id}
              style={[
                styles.thumbnail,
                selectedId === img.id && styles.thumbnailSelected
              ]}
              onPress={() => setSelectedId(img.id)}
            >
              <Image source={{ uri: img.originalUrl }} style={styles.thumbImage} />
              <View style={[
                styles.statusDot,
                img.status === 'done' && styles.statusDone,
                img.status === 'converting' && styles.statusConverting
              ]} />
              {selectedId === img.id && (
                <TouchableOpacity 
                  style={styles.thumbnailRemoveButton}
                  onPress={() => removeImage(img.id)}
                >
                  <MaterialIcons name="delete" size={16} color={tokens.colors.light} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {images.length > 0 && (
        <View style={styles.controlRow}>
          <TextInput
            style={styles.widthInput}
            placeholder="Width"
            placeholderTextColor={tokens.colors['secondary-light']}
            value={targetWidth}
            onChangeText={setTargetWidth}
            keyboardType="numeric"
          />
        </View>
      )}

      {images.length > 0 && (
        <Text style={styles.statusText} numberOfLines={1}>
          {pendingCount > 0 ? `${pendingCount} pending` : 'All done'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: tokens.colors.dark,
    borderRadius: 22,
    padding: 10,
    overflow: 'hidden',
  },
  uploadRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  button: {
    flex: 1,
    height: 24,
    backgroundColor: tokens.colors['secondary-dark'],
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    flexShrink: 1,
  },
  convertAllButton: {
    backgroundColor: tokens.colors.red,
  },
  downloadAllButton: {
    backgroundColor: tokens.colors['secondary-dark'],
  },
  buttonText: {
    ...tokens.textStyles.labelSmall,
    color: tokens.colors.light,
  },
  queueScroll: {
    height: 52,
    marginBottom: 4,
    flexGrow: 0,
  },
  thumbnail: {
    width: 50,
    height: 50,
    borderRadius: 4,
    marginRight: 4,
    position: 'relative',
    borderWidth: 1,
    borderColor: tokens.colors['secondary-dark'],
  },
  thumbnailSelected: {
    borderColor: tokens.colors.red,
    borderWidth: 2,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    borderRadius: 3,
  },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors['secondary-light'],
  },
  statusDone: {
    backgroundColor: '#00FF00',
  },
  statusConverting: {
    backgroundColor: '#FFFF00',
  },
  thumbnailRemoveButton: {
    position: 'absolute',
    top: 13,
    left: 13,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tokens.colors.red,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  widthInput: {
    flex: 1,
    height: 24,
    width: '100%',
    backgroundColor: tokens.colors['secondary-dark'],
    borderRadius: 6,
    paddingHorizontal: 8,
    ...tokens.textStyles.labelSmall,
    color: tokens.colors.light,
    flexShrink: 1,
  },
  statusText: {
    ...tokens.textStyles.labelSmall,
    color: tokens.colors['secondary-light'],
    textAlign: 'center',
  },
});